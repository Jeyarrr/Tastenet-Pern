import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../lib/HttpError.js";
import { confirmPassword } from "../services/account-security.js";
import { passwordSchema } from "../schemas/account.js";
import { transaction, audit } from "../services/transaction.js";
import { validate } from "../middleware/validate.js";

const staffInput = z.strictObject({
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[\p{L}\p{N}_.-]+$/u),
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(["admin", "rider"]),
});

export function managementRouter(db, config) {
  const router = Router();
  router.use(authenticate(db, config));

  router.get("/riders", authorize("admin", "superadmin"), async (_req, res) => {
    const result =
      await db.query(`SELECT id, full_name, phone, rider_status FROM tastenet.users
      WHERE role = 'rider' AND is_active = true AND deleted_at IS NULL ORDER BY full_name`);
    res.json({ items: result.rows });
  });

  router.get("/users", authorize("superadmin"), async (_req, res) => {
    const result =
      await db.query(`SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role,
      u.is_active, u.created_at, u.rider_status, u.vehicle, u.license_plate, u.ratings,
      coalesce(nullif(u.profile_photo,''),nullif(u.profile_picture,'')) AS profile_photo,
      (SELECT count(*)::int FROM tastenet.tickets t WHERE t.created_by=u.id) AS total_orders,
      (SELECT coalesce(sum(total_amount),0) FROM tastenet.tickets t WHERE t.created_by=u.id AND t.status='Completed') AS total_spent
      FROM tastenet.users u WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC`);
    res.json({ items: result.rows });
  });
  router.post(
    "/users",
    authorize("superadmin"),
    validate(staffInput),
    async (req, res) => {
      const v = req.validated;
      const hash = await bcrypt.hash(v.password, 12);
      const result = await db.query(
        `INSERT INTO tastenet.users
      (username, email, password_hash, full_name, phone, role, date_joined)
      VALUES ($1,$2,$3,$4,$5,$6,now())
      RETURNING id, username, email, full_name, phone, role, is_active`,
        [v.username, v.email, hash, v.fullName, v.phone ?? null, v.role],
      );
      res.status(201).json({ user: result.rows[0] });
    },
  );
  router.patch(
    "/users/:id/active",
    authorize("superadmin"),
    validate(
      z.strictObject({
        isActive: z.boolean(),
        currentPassword: z.string().min(1).max(128),
      }),
    ),
    confirmPassword(db),
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid user ID");
      if (String(id) === String(req.user.id) && !req.validated.isActive)
        throw new HttpError(
          400,
          "SELF_DEACTIVATION",
          "You cannot deactivate your own account",
        );
      const result = await transaction(db, async (client) => {
        const result = await client.query(
          `UPDATE tastenet.users SET is_active = $1, updated_at = now()
        WHERE id = $2 AND deleted_at IS NULL RETURNING id, username, role, is_active`,
          [req.validated.isActive, id],
        );
        if (!req.validated.isActive)
          await client.query(
            "DELETE FROM tastenet.auth_sessions WHERE user_id=$1",
            [id],
          );
        await audit(
          client,
          req.user,
          req.validated.isActive ? "Activate" : "Deactivate",
          "users",
          id,
        );
        return result;
      });
      if (!result.rows.length)
        throw new HttpError(404, "NOT_FOUND", "User not found");
      res.json({ user: result.rows[0] });
    },
  );

  router.get("/overview", authorize("superadmin"), async (_req, res) => {
    const [users, orders, revenue, lowStock] = await Promise.all([
      db.query(
        "SELECT count(*)::int AS value FROM tastenet.users WHERE is_active = true",
      ),
      db.query("SELECT count(*)::int AS value FROM tastenet.tickets"),
      db.query(
        "SELECT coalesce(sum(total_amount),0) AS value FROM tastenet.tickets WHERE status = 'Completed'",
      ),
      db.query(
        "SELECT count(*)::int AS value FROM tastenet.inventory WHERE is_active AND current_stock <= minimum_stock",
      ),
    ]);
    res.json({
      activeUsers: users.rows[0].value,
      orders: orders.rows[0].value,
      revenue: revenue.rows[0].value,
      lowStock: lowStock.rows[0].value,
    });
  });
  router.get("/dashboard", authorize("superadmin"), async (req, res) => {
    const range = z
      .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
      .parse(req.query);
    if (range.from && range.to && range.from > range.to)
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "End date must follow start date",
      );
    const bounds = [range.from || null, range.to || null];
    const [quotas, topMeals, revenue] = await Promise.all([
      db.query("SELECT * FROM tastenet.quotas ORDER BY id"),
      db.query(
        `SELECT ti.food_name, sum(ti.quantity) AS quantity, sum(ti.sub_total) AS revenue
        FROM tastenet.ticket_items ti JOIN tastenet.tickets t ON t.id=ti.ticket_id
        WHERE t.status='Completed' AND t.deleted_at IS NULL AND ($1::date IS NULL OR (t.created_at AT TIME ZONE 'Asia/Manila')::date >= $1) AND ($2::date IS NULL OR (t.created_at AT TIME ZONE 'Asia/Manila')::date <= $2) GROUP BY ti.food_name ORDER BY quantity DESC`,
        bounds,
      ),
      db.query(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Manila','YYYY-MM-DD') AS date,
        sum(total_amount) AS revenue FROM tastenet.tickets WHERE status='Completed' AND deleted_at IS NULL AND ($1::date IS NULL OR (created_at AT TIME ZONE 'Asia/Manila')::date >= $1) AND ($2::date IS NULL OR (created_at AT TIME ZONE 'Asia/Manila')::date <= $2) GROUP BY 1 ORDER BY 1`,
        bounds,
      ),
    ]);
    res.json({
      quotas: quotas.rows,
      topMeals: topMeals.rows,
      revenue: revenue.rows,
    });
  });
  router.patch(
    "/quotas/:id",
    authorize("superadmin"),
    validate(
      z.strictObject({
        targetAmount: z.coerce.number().finite().min(0).max(999999999),
      }),
    ),
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid quota ID");
      const result = await db.query(
        "UPDATE tastenet.quotas SET target_amount=$1 WHERE id=$2 RETURNING *",
        [req.validated.targetAmount, id],
      );
      if (!result.rows.length)
        throw new HttpError(404, "NOT_FOUND", "Quota not found");
      res.json({ quota: result.rows[0] });
    },
  );
  router.get(
    "/recipes",
    authorize("admin", "superadmin"),
    async (_req, res) => {
      const result =
        await db.query(`SELECT r.*, m.food_name, i.item_name, i.unit_of_measure, i.unit_cost
      FROM tastenet.menu_recipe_ingredients r JOIN tastenet.menu m ON m.id=r.menu_id
      JOIN tastenet.inventory i ON i.id=r.inventory_id ORDER BY m.food_name, i.item_name`);
      res.json({ items: result.rows });
    },
  );
  router.put(
    "/recipes/:menuId",
    authorize("admin", "superadmin"),
    validate(
      z.strictObject({
        ingredients: z
          .array(
            z.strictObject({
              inventoryId: z.number().int().positive(),
              quantity: z.number().finite().positive().max(999999),
            }),
          )
          .max(100)
          .refine(
            (items) =>
              new Set(items.map((item) => item.inventoryId)).size ===
              items.length,
            "Duplicate ingredients",
          ),
      }),
    ),
    async (req, res) => {
      const menuId = Number(req.params.menuId);
      if (!Number.isSafeInteger(menuId) || menuId <= 0)
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid menu ID");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const menu = await client.query(
          "SELECT id FROM tastenet.menu WHERE id=$1 FOR UPDATE",
          [menuId],
        );
        if (!menu.rows.length)
          throw new HttpError(404, "NOT_FOUND", "Menu item not found");
        await client.query(
          "DELETE FROM tastenet.menu_recipe_ingredients WHERE menu_id=$1",
          [menuId],
        );
        for (const item of req.validated.ingredients)
          await client.query(
            `INSERT INTO tastenet.menu_recipe_ingredients (menu_id, inventory_id, quantity_required) VALUES ($1,$2,$3)`,
            [menuId, item.inventoryId, item.quantity],
          );
        await client.query("COMMIT");
        res.json({ message: "Recipe saved" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );
  router.get("/transactions", authorize("superadmin"), async (_req, res) => {
    const result =
      await db.query(`SELECT t.*, i.item_name, i.unit_of_measure, (t.quantity * CASE WHEN t.transaction_type='Sale' THEN i.unit_price ELSE i.unit_cost END) AS total_value, u.full_name AS performed_by_name
      FROM tastenet.inventory_transactions t JOIN tastenet.inventory i ON i.id=t.inventory_id
      LEFT JOIN tastenet.users u ON u.id=t.performed_by ORDER BY t.transaction_date DESC`);
    res.json({ items: result.rows });
  });
  router.get("/settings", authorize("superadmin"), async (_req, res) => {
    const result =
      await db.query(`SELECT id, method_name, is_enabled, status, account_details,
      instructions, display_order, qr_photo FROM tastenet.payment_methods ORDER BY display_order, id`);
    res.json({ paymentMethods: result.rows });
  });
  router.patch(
    "/payment-methods/:id",
    authorize("superadmin"),
    validate(
      z.strictObject({
        isEnabled: z.boolean(),
        instructions: z.string().trim().max(2000),
        accountDetails: z.string().trim().max(2000),
      }),
    ),
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Invalid payment method ID",
        );
      const v = req.validated;
      const result = await db.query(
        `UPDATE tastenet.payment_methods SET is_enabled=$1, status=$2,
      instructions=$3, account_details=$4, modified_at=now() WHERE id=$5 RETURNING id, method_name, is_enabled, status`,
        [
          v.isEnabled,
          v.isEnabled ? "Active" : "Inactive",
          v.instructions,
          v.accountDetails,
          id,
        ],
      );
      if (!result.rows.length)
        throw new HttpError(404, "NOT_FOUND", "Payment method not found");
      res.json({ method: result.rows[0] });
    },
  );
  return router;
}
