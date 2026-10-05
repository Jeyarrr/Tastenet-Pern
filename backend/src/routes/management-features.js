import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../lib/HttpError.js";
import { validate } from "../middleware/validate.js";
import { transaction, audit } from "../services/transaction.js";
import { confirmPassword } from "../services/account-security.js";
import { documentColumns } from "../schemas/rider.js";
import { ownedFile } from "../services/media.js";

export const paymentSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  isEnabled: z.boolean(),
  instructions: z.string().trim().max(2000),
  accountDetails: z.string().trim().max(2000),
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
  qrPhoto: z.string().max(150).optional(),
});
export function managementFeaturesRouter(db, config) {
  const router = Router();
  router.use(authenticate(db, config), authorize("superadmin"));
  router.param("id", (req, _res, next, value) => {
    if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)
      return next(new HttpError(400, "VALIDATION_ERROR", "Invalid record ID"));
    next();
  });
  router.get("/users/:id/details", async (req, res) => {
    const user = (
      await db.query(
        `SELECT id,full_name,username,email,phone,address,role,is_active,vehicle,vehicle_model,vehicle_year,vehicle_color,license_plate,coalesce(nullif(profile_photo,''),nullif(profile_picture,'')) AS profile_photo,${documentColumns.join(",")}
      FROM tastenet.users WHERE id=$1 AND deleted_at IS NULL`,
        [req.params.id],
      )
    ).rows[0];
    if (!user) throw new HttpError(404, "NOT_FOUND", "User not found");
    const orders = await db.query(
      "SELECT * FROM tastenet.tickets WHERE (created_by=$1 OR rider_id=$1) AND deleted_at IS NULL ORDER BY created_at DESC",
      [user.id],
    );
    const reviews = await db.query(
      "SELECT * FROM tastenet.rider_doc_approvals WHERE user_id=$1",
      [user.id],
    );
    res.json({
      user,
      orders: orders.rows,
      documents: documentColumns.map((column) => ({
        column,
        url: user[column],
        status: "pending",
        ...reviews.rows.find((r) => r.doc_column === column),
      })),
    });
  });
  router.patch(
    "/users/:id",
    validate(
      z.strictObject({
        fullName: z.string().trim().min(1).max(200),
        phone: z.string().trim().max(40),
        email: z.email().max(320),
        address: z.string().trim().max(1000),
        vehicle: z.string().trim().max(100),
        vehicleModel: z.string().trim().max(100),
        licensePlate: z.string().trim().max(40),
      }),
    ),
    async (req, res) => {
      const v = req.validated;
      const result = await db.query(
        `UPDATE tastenet.users SET full_name=$1,phone=$2,email=$3::text,
      email_verified=CASE WHEN email=$3::text THEN email_verified ELSE false END,
      address_details=CASE WHEN address=$4::text THEN address_details ELSE NULL END,address=$4::text,vehicle=$5,vehicle_model=$6,license_plate=$7,updated_at=now()
      WHERE id=$8 AND role IN ('customer','rider','admin') AND deleted_at IS NULL RETURNING id`,
        [
          v.fullName,
          v.phone,
          v.email.toLowerCase(),
          v.address,
          v.vehicle,
          v.vehicleModel,
          v.licensePlate,
          req.params.id,
        ],
      );
      if (!result.rows.length)
        throw new HttpError(404, "NOT_FOUND", "Account not found");
      res.json({ message: "Account updated" });
    },
  );
  router.delete(
    "/users/:id",
    validate(z.strictObject({ currentPassword: z.string().min(1).max(128) })),
    confirmPassword(db),
    async (req, res) => {
      if (String(req.user.id) === req.params.id)
        throw new HttpError(
          400,
          "SELF_DELETION",
          "You cannot remove your own account",
        );
      await transaction(db, async (client) => {
        const active = await client.query(
          `SELECT 1 FROM tastenet.tickets WHERE rider_id=$1 AND status IN ('Open','In Progress') AND deleted_at IS NULL`,
          [req.params.id],
        );
        if (active.rows.length)
          throw new HttpError(
            409,
            "ACTIVE_DELIVERIES",
            "Reassign active deliveries before removing this rider",
          );
        const changed = await client.query(
          `UPDATE tastenet.users SET deleted_at=now(),is_active=false WHERE id=$1 AND role<>'superadmin' AND deleted_at IS NULL RETURNING id`,
          [req.params.id],
        );
        if (!changed.rows.length)
          throw new HttpError(404, "NOT_FOUND", "Account not found");
        await client.query(
          "DELETE FROM tastenet.auth_sessions WHERE user_id=$1",
          [req.params.id],
        );
        await audit(client, req.user, "Archive", "users", req.params.id);
      });
      res.status(204).end();
    },
  );
  router.patch(
    "/users/:id/documents/:column",
    validate(
      z.strictObject({
        status: z.enum(["approved", "rejected", "pending"]),
        notes: z.string().trim().max(1000).optional(),
      }),
    ),
    async (req, res) => {
      const column = z.enum(documentColumns).parse(req.params.column);
      const user = (
        await db.query(
          `SELECT ${column} AS url FROM tastenet.users WHERE id=$1 AND role='rider' AND deleted_at IS NULL`,
          [req.params.id],
        )
      ).rows[0];
      if (!user?.url)
        throw new HttpError(404, "NOT_FOUND", "No document has been uploaded");
      await db.query(
        `INSERT INTO tastenet.rider_doc_approvals(user_id,doc_column,status,reviewed_by,review_notes) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT(user_id,doc_column) DO UPDATE SET status=$3,reviewed_by=$4,review_notes=$5,updated_at=now()`,
        [
          req.params.id,
          column,
          req.validated.status,
          req.user.id,
          req.validated.notes || null,
        ],
      );
      res.json({ message: "Document review saved" });
    },
  );
  router.post("/payment-methods", validate(paymentSchema), async (req, res) => {
    const v = req.validated;
    if (v.qrPhoto) await ownedFile(db, v.qrPhoto, req.user.id, "payment-qr");
    const result = await db.query(
      `INSERT INTO tastenet.payment_methods(method_name,is_enabled,status,instructions,account_details,display_order,qr_photo)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        v.name,
        v.isEnabled,
        v.isEnabled ? "Active" : "Inactive",
        v.instructions,
        v.accountDetails,
        v.displayOrder,
        v.qrPhoto || null,
      ],
    );
    res.status(201).json({ method: result.rows[0] });
  });
  router.put(
    "/payment-methods/:id",
    validate(paymentSchema),
    async (req, res) => {
      const v = req.validated;
      const previous = (
        await db.query(
          "SELECT qr_photo FROM tastenet.payment_methods WHERE id=$1",
          [req.params.id],
        )
      ).rows[0];
      if (!previous)
        throw new HttpError(404, "NOT_FOUND", "Payment method not found");
      if (v.qrPhoto && v.qrPhoto !== previous.qr_photo)
        await ownedFile(db, v.qrPhoto, req.user.id, "payment-qr");
      await db.query(
        `UPDATE tastenet.payment_methods SET method_name=$1,is_enabled=$2,status=$3,instructions=$4,account_details=$5,display_order=$6,qr_photo=$7,modified_at=now() WHERE id=$8`,
        [
          v.name,
          v.isEnabled,
          v.isEnabled ? "Active" : "Inactive",
          v.instructions,
          v.accountDetails,
          v.displayOrder,
          v.qrPhoto || null,
          req.params.id,
        ],
      );
      res.json({ message: "Payment method saved" });
    },
  );
  router.delete("/payment-methods/:id", async (req, res) => {
    await db.query("DELETE FROM tastenet.payment_methods WHERE id=$1", [
      req.params.id,
    ]);
    res.status(204).end();
  });
  router.post(
    "/quotas",
    validate(
      z
        .strictObject({
          type: z.enum(["Daily", "Weekly", "Monthly"]),
          targetAmount: z.coerce.number().finite().min(0).max(999999999),
          startDate: z.iso.date(),
          endDate: z.iso.date(),
        })
        .refine(
          (v) => v.endDate >= v.startDate,
          "End date must follow start date",
        ),
    ),
    async (req, res) => {
      const v = req.validated;
      const result = await db.query(
        `INSERT INTO tastenet.quotas(quota_type,target_amount,start_date,end_date) VALUES ($1,$2,$3,$4)
      ON CONFLICT(quota_type) DO UPDATE SET target_amount=$2,start_date=$3,end_date=$4,updated_at=now() RETURNING *`,
        [v.type, v.targetAmount, v.startDate, v.endDate],
      );
      res.json({ quota: result.rows[0] });
    },
  );
  router.get("/transactions/:id", async (req, res) => {
    const result = await db.query(
      `SELECT t.*,i.item_name,u.full_name AS performed_by_name FROM tastenet.inventory_transactions t JOIN tastenet.inventory i ON i.id=t.inventory_id LEFT JOIN tastenet.users u ON u.id=t.performed_by WHERE t.id=$1`,
      [req.params.id],
    );
    if (!result.rows.length)
      throw new HttpError(404, "NOT_FOUND", "Transaction not found");
    const audit = await db.query(
      "SELECT change_type,old_value,new_value,change_date FROM tastenet.transaction_audit WHERE transaction_id=$1 ORDER BY change_date",
      [req.params.id],
    );
    res.json({ transaction: result.rows[0], audit: audit.rows });
  });
  return router;
}
