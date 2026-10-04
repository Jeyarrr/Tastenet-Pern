import { Router } from "express";
import { z } from "zod";
import { authorize } from "../auth.js";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";
import { transaction, audit } from "../services/transaction.js";
import { ownedFile } from "./files.js";

export function orderFeaturesRouter(db) {
  const router = Router();
  router.param("id", (req, _res, next, value) => {
    if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)
      return next(new HttpError(400, "VALIDATION_ERROR", "Invalid order ID"));
    next();
  });
  const allowedOrder = async (req, client = db) => {
    const order = (
      await client.query(
        "SELECT * FROM tastenet.tickets WHERE id=$1 AND deleted_at IS NULL",
        [req.params.id],
      )
    ).rows[0];
    if (!order) throw new HttpError(404, "NOT_FOUND", "Order not found");
    if (
      (req.user.role === "customer" &&
        String(order.created_by) !== String(req.user.id)) ||
      (req.user.role === "rider" &&
        String(order.rider_id) !== String(req.user.id))
    )
      throw new HttpError(403, "FORBIDDEN", "This order is private");
    return order;
  };
  router.get("/:id/details", async (req, res) => {
    const order = await allowedOrder(req);
    const [items, proofs, history, rating] = await Promise.all([
      db.query(
        "SELECT * FROM tastenet.ticket_items WHERE ticket_id=$1 ORDER BY id",
        [order.id],
      ),
      db.query(
        "SELECT id,proof_of_delivery,proof_of_payment,created_at FROM tastenet.proofs WHERE ticket_id=$1 ORDER BY id",
        [order.id],
      ),
      db.query(
        `SELECT l.old_status,l.new_status,l.changed_date,u.full_name AS changed_by_name FROM tastenet.order_status_log l
        LEFT JOIN tastenet.users u ON u.id=l.changed_by WHERE order_id=$1 ORDER BY changed_date`,
        [String(order.id)],
      ),
      db.query(
        "SELECT rating,comment FROM tastenet.order_ratings WHERE ticket_id=$1",
        [order.id],
      ),
    ]);
    res.json({
      order,
      items: items.rows,
      proofs: proofs.rows,
      history: history.rows,
      rating: rating.rows[0] || null,
    });
  });
  router.post(
    "/:id/rating",
    authorize("customer"),
    validate(
      z.strictObject({
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1000).optional(),
      }),
    ),
    async (req, res) => {
      await transaction(db, async (client) => {
        const order = await allowedOrder(req, client);
        if (order.status !== "Completed")
          throw new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Rate an order after it is completed",
          );
        await client.query(
          "INSERT INTO tastenet.order_ratings(ticket_id,user_id,rating,comment) VALUES ($1,$2,$3,$4)",
          [
            order.id,
            req.user.id,
            req.validated.rating,
            req.validated.comment || null,
          ],
        );
        const items = await client.query(
          "SELECT DISTINCT menu_id FROM tastenet.ticket_items WHERE ticket_id=$1 AND menu_id IS NOT NULL ORDER BY menu_id",
          [order.id],
        );
        for (const item of items.rows)
          await client.query(
            `UPDATE tastenet.menu SET ratings=round((coalesce(ratings,0)*rating_count+$1)/(rating_count+1),2),rating_count=rating_count+1 WHERE id=$2`,
            [req.validated.rating, item.menu_id],
          );
      });
      res.status(201).json({ message: "Thank you for rating your order" });
    },
  );
  router.post(
    "/:id/payment-proof",
    authorize("customer"),
    validate(z.strictObject({ url: z.string().max(150) })),
    async (req, res) => {
      await transaction(db, async (client) => {
        const order = await allowedOrder(req, client);
        if (["Completed", "Cancelled"].includes(order.status))
          throw new HttpError(409, "ORDER_CLOSED", "This order is closed");
        await ownedFile(
          client,
          req.validated.url,
          req.user.id,
          "payment-proof",
          order.id,
        );
        await client.query(
          "INSERT INTO tastenet.proofs(ticket_id,proof_of_payment) VALUES ($1,$2)",
          [order.id, req.validated.url],
        );
      });
      res.status(201).json({ message: "Payment proof submitted" });
    },
  );
  router.patch(
    "/:id/priority",
    authorize("admin", "superadmin"),
    validate(z.strictObject({ priority: z.enum(["Normal", "Rush"]) })),
    async (req, res) => {
      const result = await db.query(
        `UPDATE tastenet.tickets SET priority=$1,updated_at=now() WHERE id=$2 AND status NOT IN ('Completed','Cancelled') AND deleted_at IS NULL RETURNING *`,
        [req.validated.priority, req.params.id],
      );
      if (!result.rows.length)
        throw new HttpError(
          409,
          "ORDER_CLOSED",
          "Only an open ticket can change priority",
        );
      res.json({ order: result.rows[0] });
    },
  );
  router.delete("/:id", authorize("admin", "superadmin"), async (req, res) => {
    await transaction(db, async (client) => {
      const order = (
        await client.query(
          "SELECT * FROM tastenet.tickets WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
          [req.params.id],
        )
      ).rows[0];
      if (!order) throw new HttpError(404, "NOT_FOUND", "Ticket not found");
      if (!["Completed", "Cancelled"].includes(order.status))
        throw new HttpError(
          409,
          "ACTIVE_ORDER",
          "Complete or cancel the ticket before removing it",
        );
      await client.query(
        "UPDATE tastenet.tickets SET deleted_at=now() WHERE id=$1",
        [order.id],
      );
      await audit(client, req.user, "Archive", "tickets", order.id);
    });
    res.status(204).end();
  });
  return router;
}
