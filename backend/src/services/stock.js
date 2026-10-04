import { HttpError } from "../errors.js";

// Called with the order already locked. All ingredient locks use the same order.
export async function deductRecipeStock(client, order, user) {
  if (order.stock_deducted_at) return;
  const requirements = await client.query(
    `SELECT r.inventory_id, sum(r.quantity_required * ti.quantity) AS quantity
    FROM tastenet.ticket_items ti JOIN tastenet.menu_recipe_ingredients r ON r.menu_id=ti.menu_id
    WHERE ti.ticket_id=$1 GROUP BY r.inventory_id ORDER BY r.inventory_id`,
    [order.id],
  );
  for (const item of requirements.rows) {
    const found = await client.query(
      "SELECT * FROM tastenet.inventory WHERE id=$1 FOR UPDATE",
      [item.inventory_id],
    );
    const stock = found.rows[0];
    if (
      !stock?.is_active ||
      !stock.is_available ||
      Number(stock.current_stock) < Number(item.quantity)
    ) {
      throw new HttpError(
        409,
        "INSUFFICIENT_STOCK",
        `Insufficient available stock for ${stock?.item_name || "an ingredient"}. Restock before starting this ticket.`,
      );
    }
    const updated = await client.query(
      `UPDATE tastenet.inventory SET current_stock=current_stock-$1, updated_at=now()
      WHERE id=$2 RETURNING current_stock`,
      [item.quantity, item.inventory_id],
    );
    await client.query(
      `INSERT INTO tastenet.inventory_transactions
      (inventory_id,transaction_type,quantity,previous_stock,new_stock,reference_number,notes,performed_by)
      VALUES ($1,'Sale',$2,$3,$4,$5,'Recipe consumption when preparation started',$6)`,
      [
        item.inventory_id,
        item.quantity,
        stock.current_stock,
        updated.rows[0].current_stock,
        order.ticket_number,
        user.id,
      ],
    );
  }
  await client.query(
    "UPDATE tastenet.tickets SET stock_deducted_at=now() WHERE id=$1",
    [order.id],
  );
}
