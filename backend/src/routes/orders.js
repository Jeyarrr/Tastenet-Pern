import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../auth.js';
import { HttpError } from '../errors.js';
import { validate } from '../validate.js';

const orderInput = z.strictObject({
  items: z.array(z.strictObject({
    menuId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(50),
    specialInstructions: z.string().trim().max(500).optional()
  })).min(1).max(30),
  deliveryAddress: z.string().trim().max(1000),
  barangayName: z.string().trim().max(120),
  paymentMethod: z.string().trim().min(1).max(120),
  orderType: z.enum(['Delivery', 'Dine-In', 'Take-Out']).optional()
});
const statusInput = z.strictObject({ status: z.enum(['Open', 'In Progress', 'Completed', 'Cancelled']) });
const assignInput = z.strictObject({ riderId: z.coerce.number().int().positive() });

async function transaction(db, action) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function ordersRouter(db, config) {
  const router = Router();
  router.use(authenticate(db, config));

  router.get('/', async (req, res) => {
    const role = req.user.role;
    const where = role === 'customer' ? 'WHERE t.created_by = $1'
      : role === 'rider' ? 'WHERE t.rider_id = $1' : '';
    const args = role === 'customer' || role === 'rider' ? [req.user.id] : [];
    const result = await db.query(`SELECT t.*, c.full_name AS customer_name, c.phone AS customer_phone,
      r.full_name AS rider_name,
      (SELECT count(*)::int FROM tastenet.ticket_items ti WHERE ti.ticket_id = t.id) AS item_count
      FROM tastenet.tickets t
      LEFT JOIN tastenet.users c ON c.id = t.created_by
      LEFT JOIN tastenet.users r ON r.id = t.rider_id
      ${where} ORDER BY t.created_at DESC LIMIT 200`, args);
    res.json({ items: result.rows });
  });

  router.get('/:id/items', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid order ID');
    const ticket = await db.query('SELECT created_by, rider_id FROM tastenet.tickets WHERE id = $1', [id]);
    if (!ticket.rows.length) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    const row = ticket.rows[0];
    if ((req.user.role === 'customer' && String(row.created_by) !== String(req.user.id)) ||
        (req.user.role === 'rider' && String(row.rider_id) !== String(req.user.id))) {
      throw new HttpError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    const result = await db.query('SELECT * FROM tastenet.ticket_items WHERE ticket_id = $1 ORDER BY id', [id]);
    res.json({ items: result.rows });
  });

  router.post('/', authorize('customer', 'admin', 'superadmin'), validate(orderInput), async (req, res) => {
    const input = req.validated;
    const orderType = input.orderType || 'Delivery';
    if (req.user.role === 'customer' && orderType !== 'Delivery')
      throw new HttpError(403, 'FORBIDDEN', 'Customer orders must use delivery');
    if (orderType === 'Delivery' && input.deliveryAddress.length < 5)
      throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a delivery address');
    const created = await transaction(db, async client => {
      const feeResult = orderType === 'Delivery'
        ? await client.query('SELECT fee FROM tastenet.delivery_fees WHERE barangay_name = $1', [input.barangayName])
        : { rows: [{ fee: 0 }] };
      if (!feeResult.rows.length) throw new HttpError(400, 'INVALID_BARANGAY', 'Select a listed barangay');
      const payment = await client.query(`SELECT 1 FROM tastenet.payment_methods
        WHERE method_name = $1 AND is_enabled = true AND status = 'Active'`, [input.paymentMethod]);
      if (!payment.rows.length) throw new HttpError(400, 'INVALID_PAYMENT_METHOD', 'Select an available payment method');

      const menuIds = [...new Set(input.items.map(item => item.menuId))];
      const menu = await client.query(`SELECT id, food_name, price FROM tastenet.menu
        WHERE id = ANY($1::bigint[]) AND status = 'active'`, [menuIds]);
      const menuById = new Map(menu.rows.map(item => [Number(item.id), item]));
      if (menuById.size !== menuIds.length) throw new HttpError(400, 'INVALID_MENU_ITEM', 'An item is unavailable');

      const subtotalCents = input.items.reduce((sum, item) =>
        sum + Math.round(Number(menuById.get(item.menuId).price) * 100) * item.quantity, 0);
      const deliveryCents = subtotalCents >= 50000 ? 0 : Math.round(Number(feeResult.rows[0].fee) * 100);
      const ticketNumber = `TN-${randomUUID().slice(0, 8).toUpperCase()}`;
      const orderNumber = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
      const result = await client.query(`INSERT INTO tastenet.tickets
        (ticket_number, order_number, order_type, delivery_address, status, priority,
         total_amount, payment_method, created_by)
        VALUES ($1,$2,$7,$3,'Open','Normal',$4,$5,$6) RETURNING *`,
      [ticketNumber, orderNumber, orderType === 'Delivery' ? input.deliveryAddress : null,
        (subtotalCents + deliveryCents) / 100, input.paymentMethod, req.user.id, orderType]);
      for (const item of input.items) {
        const product = menuById.get(item.menuId);
        const unitCents = Math.round(Number(product.price) * 100);
        await client.query(`INSERT INTO tastenet.ticket_items
          (ticket_id, menu_id, food_name, quantity, unit_price, sub_total, special_instructions)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [result.rows[0].id, item.menuId, product.food_name, item.quantity,
          unitCents / 100, unitCents * item.quantity / 100, item.specialInstructions ?? null]);
      }
      return result.rows[0];
    });
    res.status(201).json({ order: created });
  });

  router.patch('/:id/status', validate(statusInput), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid order ID');
    const { status } = req.validated;
    const result = await transaction(db, async client => {
      const found = await client.query('SELECT * FROM tastenet.tickets WHERE id = $1 FOR UPDATE', [id]);
      const order = found.rows[0];
      if (!order) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
      if (req.user.role === 'customer') {
        if (String(order.created_by) !== String(req.user.id) || order.status !== 'Open' || status !== 'Cancelled')
          throw new HttpError(403, 'FORBIDDEN', 'This order cannot be cancelled');
      } else if (req.user.role === 'rider') {
        if (String(order.rider_id) !== String(req.user.id) || order.status !== 'In Progress' || status !== 'Completed')
          throw new HttpError(403, 'FORBIDDEN', 'This delivery cannot be completed');
      }
      if (['Completed', 'Cancelled'].includes(order.status))
        throw new HttpError(409, 'ORDER_CLOSED', 'This order is already closed');
      const updated = await client.query(`UPDATE tastenet.tickets SET status = $1::varchar,
        started_at = CASE WHEN $1::varchar = 'In Progress' THEN coalesce(started_at, now()) ELSE started_at END,
        completed_at = CASE WHEN $1::varchar = 'Completed' THEN now() ELSE completed_at END,
        updated_at = now() WHERE id = $2 RETURNING *`, [status, id]);
      return updated.rows[0];
    });
    res.json({ order: result });
  });

  router.patch('/:id/assign', authorize('admin', 'superadmin'), validate(assignInput), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid order ID');
    const rider = await db.query("SELECT 1 FROM tastenet.users WHERE id = $1 AND role = 'rider' AND is_active = true", [req.validated.riderId]);
    if (!rider.rows.length) throw new HttpError(400, 'INVALID_RIDER', 'Select an active rider');
    const result = await db.query(`UPDATE tastenet.tickets SET rider_id = $1, updated_at = now()
      WHERE id = $2 AND status NOT IN ('Completed', 'Cancelled') RETURNING *`, [req.validated.riderId, id]);
    if (!result.rows.length) throw new HttpError(404, 'NOT_FOUND', 'Open order not found');
    res.json({ order: result.rows[0] });
  });
  return router;
}
