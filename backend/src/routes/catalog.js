import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../auth.js';
import { HttpError } from '../errors.js';
import { validate } from '../validate.js';

const menuInput = z.strictObject({
  foodName: z.string().trim().min(1).max(200),
  foodType: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().finite().min(0).max(999999),
  imagePath: z.string().trim().max(1000).optional(),
  status: z.enum(['active', 'inactive']).optional()
});
const inventoryInput = z.strictObject({
  itemCode: z.string().trim().min(1).max(80),
  itemName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  currentStock: z.coerce.number().finite().min(0),
  minimumStock: z.coerce.number().finite().min(0),
  unitCost: z.coerce.number().finite().min(0),
  unitPrice: z.coerce.number().finite().min(0),
  unitOfMeasure: z.string().trim().min(1).max(40),
  isAvailable: z.boolean().optional()
});

export function catalogRouter(db, config) {
  const router = Router();
  const staff = [authenticate(db, config), authorize('admin', 'superadmin')];

  router.get('/menu', async (_req, res) => {
    const result = await db.query(`SELECT id, food_name, food_type, description, price, image_path, ratings
      FROM tastenet.menu WHERE status = 'active' ORDER BY food_type, food_name`);
    res.json({ items: result.rows });
  });
  router.get('/delivery-fees', async (_req, res) => {
    const result = await db.query('SELECT id, barangay_name, fee FROM tastenet.delivery_fees ORDER BY barangay_name');
    res.json({ items: result.rows });
  });
  router.get('/payment-methods', async (_req, res) => {
    const result = await db.query(`SELECT id, method_name, instructions FROM tastenet.payment_methods
      WHERE is_enabled = true AND status = 'Active' ORDER BY display_order, id`);
    res.json({ items: result.rows });
  });

  router.get('/staff/menu', ...staff, async (_req, res) => {
    const result = await db.query(`SELECT id, food_name, food_type, description, price, image_path, status
      FROM tastenet.menu ORDER BY id DESC`);
    res.json({ items: result.rows });
  });
  router.post('/staff/menu', ...staff, validate(menuInput), async (req, res) => {
    const v = req.validated;
    const result = await db.query(`INSERT INTO tastenet.menu
      (food_name, food_type, description, price, image_path, status)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [v.foodName, v.foodType, v.description ?? null, v.price, v.imagePath ?? null, v.status ?? 'active']);
    res.status(201).json({ item: result.rows[0] });
  });
  router.patch('/staff/menu/:id', ...staff, validate(menuInput.partial()), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid menu ID');
    const keys = { foodName: 'food_name', foodType: 'food_type', description: 'description',
      price: 'price', imagePath: 'image_path', status: 'status' };
    const fields = Object.entries(req.validated);
    if (!fields.length) throw new HttpError(400, 'VALIDATION_ERROR', 'No changes supplied');
    const values = fields.map(([, value]) => value);
    const changes = fields.map(([key], index) => `${keys[key]} = $${index + 1}`).join(', ');
    const result = await db.query(`UPDATE tastenet.menu SET ${changes}, updated_at = now()
      WHERE id = $${values.length + 1} RETURNING *`, [...values, id]);
    if (!result.rows.length) throw new HttpError(404, 'NOT_FOUND', 'Menu item not found');
    res.json({ item: result.rows[0] });
  });

  router.get('/staff/inventory', ...staff, async (_req, res) => {
    const result = await db.query(`SELECT i.*, c.category_name FROM tastenet.inventory i
      LEFT JOIN tastenet.inventory_categories c ON c.id = i.category_id
      WHERE i.is_active = true ORDER BY i.item_name`);
    res.json({ items: result.rows });
  });
  router.get('/staff/inventory-categories', ...staff, async (_req, res) => {
    const result = await db.query(`SELECT id, category_name FROM tastenet.inventory_categories
      WHERE is_active = true ORDER BY category_name`);
    res.json({ items: result.rows });
  });
  router.post('/staff/restock', ...staff, validate(z.strictObject({
    items: z.array(z.strictObject({ id: z.number().int().positive(), quantity: z.number().finite().positive().max(999999) })).min(1).max(100)
      .refine(items => new Set(items.map(item => item.id)).size === items.length, 'Duplicate ingredients')
  })), async (req, res) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const item of [...req.validated.items].sort((a,b) => a.id-b.id)) {
        const found = await client.query('SELECT current_stock FROM tastenet.inventory WHERE id=$1 AND is_active FOR UPDATE', [item.id]);
        if (!found.rows.length) throw new HttpError(404, 'NOT_FOUND', 'Ingredient not found');
        const updated = await client.query('UPDATE tastenet.inventory SET current_stock=current_stock+$1, updated_at=now() WHERE id=$2 RETURNING current_stock', [item.quantity, item.id]);
        await client.query(`INSERT INTO tastenet.inventory_transactions
          (inventory_id,transaction_type,quantity,previous_stock,new_stock,notes,performed_by)
          VALUES ($1,'Restock',$2,$3,$4,'Bulk restock',$5)`, [item.id, item.quantity, found.rows[0].current_stock, updated.rows[0].current_stock, req.user.id]);
      }
      await client.query('COMMIT');
      res.json({ message: 'Stock replenished' });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
  router.post('/staff/inventory', ...staff, validate(inventoryInput), async (req, res) => {
    const v = req.validated;
    const result = await db.query(`INSERT INTO tastenet.inventory
      (item_code, item_name, description, category_id, current_stock, minimum_stock,
       reorder_level, unit_cost, unit_price, unit_of_measure, is_available)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10) RETURNING *`,
    [v.itemCode, v.itemName, v.description ?? null, v.categoryId ?? null, v.currentStock,
      v.minimumStock, v.unitCost, v.unitPrice, v.unitOfMeasure, v.isAvailable ?? true]);
    res.status(201).json({ item: result.rows[0] });
  });
  router.patch('/staff/inventory/:id', ...staff, validate(inventoryInput.partial()), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid inventory ID');
    const keys = { itemCode: 'item_code', itemName: 'item_name', description: 'description',
      categoryId: 'category_id', currentStock: 'current_stock', minimumStock: 'minimum_stock',
      unitCost: 'unit_cost', unitPrice: 'unit_price', unitOfMeasure: 'unit_of_measure',
      isAvailable: 'is_available' };
    const fields = Object.entries(req.validated);
    if (!fields.length) throw new HttpError(400, 'VALIDATION_ERROR', 'No changes supplied');
    const values = fields.map(([, value]) => value);
    const changes = fields.map(([key], index) => `${keys[key]} = $${index + 1}`).join(', ');
    const result = await db.query(`UPDATE tastenet.inventory SET ${changes}, updated_at = now()
      WHERE id = $${values.length + 1} AND is_active = true RETURNING *`, [...values, id]);
    if (!result.rows.length) throw new HttpError(404, 'NOT_FOUND', 'Inventory item not found');
    res.json({ item: result.rows[0] });
  });
  return router;
}
