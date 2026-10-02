-- Synthetic demonstration records only. No customers, credentials, or production data.
BEGIN;
SET LOCAL search_path TO tastenet, public;

INSERT INTO inventory_categories (category_name) VALUES
    ('Sample Ingredients'), ('Sample Packaging')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO inventory (item_code, item_name, description, category_id, current_stock,
                       minimum_stock, reorder_level, unit_cost, unit_price, unit_of_measure)
SELECT 'SAMPLE-RICE', 'Sample Rice', 'Demonstration inventory item', id,
       25, 5, 10, 35, 45, 'kg'
FROM inventory_categories WHERE category_name = 'Sample Ingredients'
ON CONFLICT (item_code) DO NOTHING;

INSERT INTO menu (food_name, food_type, description, price, status)
SELECT 'Sample Rice Bowl', 'Sample Meals', 'Demonstration menu item', 149, 'active'
WHERE NOT EXISTS (SELECT 1 FROM menu WHERE food_name = 'Sample Rice Bowl');

INSERT INTO delivery_fees (barangay_name, fee) VALUES
    ('Sample Barangay A', 35), ('Sample Barangay B', 50)
ON CONFLICT (barangay_name) DO NOTHING;

INSERT INTO payment_methods (method_name, display_order, instructions) VALUES
    ('Cash on Delivery', 1, 'Sample payment method; collect on delivery.')
ON CONFLICT (method_name) DO NOTHING;

COMMIT;
