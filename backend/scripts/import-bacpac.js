import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { readConfig } from '../src/config.js';

// Reads the separately imported BACPAC snapshot through an in-memory pipe.
// Legacy plaintext passwords never enter a file or PostgreSQL; bcrypt hashes do.
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database/export-bacpac-snapshot.ps1');
const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
  { stdio: ['ignore', 'pipe', 'pipe'] });
const source = new Map();
const read = (async () => {
  for await (const line of createInterface({ input: child.stdout })) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const table = row._table;
    delete row._table;
    if (!source.has(table)) source.set(table, []);
    source.get(table).push(row);
  }
})();
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk.toString(); });
const exitCode = await new Promise(resolve => child.once('close', resolve));
await read;
if (exitCode !== 0) throw new Error(`BACPAC snapshot export failed: ${stderr.slice(0, 500)}`);

const order = [
  ['Users', 'users'], ['AdminAccounts', 'admin_accounts'],
  ['ApplicationSettings', 'application_settings'],
  ['Suppliers', 'suppliers'], ['InventoryCategories', 'inventory_categories'],
  ['Menu', 'menu'], ['DeliveryFees', 'delivery_fees'], ['PaymentMethods', 'payment_methods'],
  ['Quotas', 'quotas'], ['Inventory', 'inventory'], ['Tickets', 'tickets'],
  ['MenuRecipeIngredients', 'menu_recipe_ingredients'],
  ['InventoryTransactions', 'inventory_transactions'], ['TicketItems', 'ticket_items'],
  ['RiderDocApprovals', 'rider_doc_approvals'], ['TransactionAudit', 'transaction_audit'],
  ['AuditLogs', 'audit_logs'], ['OrderStatusLog', 'order_status_log'], ['Proofs', 'proofs'],
  ['PurchaseOrders', 'purchase_orders'], ['PurchaseOrderItems', 'purchase_order_items']
];
const identity = new Map([
  ['Users', 'UserID'], ['AdminAccounts', 'AdminId'], ['ApplicationSettings', 'SettingId'],
  ['Suppliers', 'SupplierID'], ['InventoryCategories', 'CategoryID'],
  ['Menu', 'MenuID'], ['DeliveryFees', 'DeliveryFeeID'], ['PaymentMethods', 'PaymentMethodId'],
  ['Quotas', 'QuotaID'], ['Inventory', 'InventoryID'], ['Tickets', 'TicketID'],
  ['MenuRecipeIngredients', 'RecipeID'], ['InventoryTransactions', 'TransactionID'],
  ['TicketItems', 'TicketItemID'], ['RiderDocApprovals', 'ID'], ['TransactionAudit', 'AuditID'],
  ['AuditLogs', 'LogId'], ['OrderStatusLog', 'LogID'], ['Proofs', 'ProofID'],
  ['PurchaseOrders', 'PurchaseOrderID'], ['PurchaseOrderItems', 'POItemID']
]);
const special = {
  CreatedDate: 'created_at', ModifiedDate: 'modified_at', PONumber: 'po_number',
  NBINumber: 'nbi_number', NBIClearancePhoto: 'nbi_clearance_photo',
  ORCRNumber: 'orcr_number', ORCRPhoto: 'orcr_photo'
};
const snake = name => special[name] || name.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();
const normalizeValue = value => {
  if (typeof value === 'string') {
    const match = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
    if (match) return new Date(Number(match[1])).toISOString();
  }
  return value;
};
const config = readConfig();
const client = new pg.Client({ connectionString: config.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const seedState = await client.query(`SELECT
    (SELECT count(*)::int FROM tastenet.users) AS users,
    (SELECT count(*)::int FROM tastenet.menu) AS menu,
    (SELECT count(*)::int FROM tastenet.inventory) AS inventory,
    (SELECT count(*)::int FROM tastenet.delivery_fees) AS fees,
    (SELECT count(*)::int FROM tastenet.tickets) AS tickets`);
  const state = seedState.rows[0];
  const replaceInitialImport = process.argv.includes('--replace-initial-import');
  if (!replaceInitialImport &&
    (state.users !== 0 || state.menu !== 1 || state.inventory !== 1 || state.fees !== 2 || state.tickets !== 0))
    throw new Error('Target contains data beyond the original safe sample seed; refusing to replace it');
  const currentTables = await client.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'tastenet' AND table_type = 'BASE TABLE'`);
  for (const table of currentTables.rows) {
    const count = await client.query(`SELECT count(*)::int AS n FROM tastenet."${table.table_name}"`);
    if (replaceInitialImport) {
      const prior = order.find(([name, target]) => target === table.table_name &&
        !['AdminAccounts', 'ApplicationSettings'].includes(name));
      const expected = prior ? (source.get(prior[0]) || []).length : 0;
      if (count.rows[0].n !== expected) throw new Error(`Target ${table.table_name} changed since initial import`);
    } else if (!['menu','inventory','delivery_fees','payment_methods','inventory_categories'].includes(table.table_name)
      && count.rows[0].n !== 0) throw new Error(`Target ${table.table_name} already has data`);
  }
  await client.query(`TRUNCATE ${currentTables.rows.map(row => `tastenet."${row.table_name}"`).join(', ')} RESTART IDENTITY CASCADE`);

  for (const [sourceName, targetName] of order) {
    const sourceRows = source.get(sourceName) || [];
    const columnsResult = await client.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'tastenet' AND table_name = $1`, [targetName]);
    const columns = new Set(columnsResult.rows.map(row => row.column_name));
    for (const original of sourceRows) {
      const row = {};
      for (const [name, value] of Object.entries(original)) {
        if ((sourceName === 'Users' && name === 'Password') ||
            (sourceName === 'AdminAccounts' && name === 'PasswordHash')) {
          row.password_hash = await bcrypt.hash(value || randomBytes(32).toString('hex'), 12);
          continue;
        }
        const target = name === identity.get(sourceName) ? 'id'
          : sourceName === 'Users' && name === 'UserType' ? 'role' : snake(name);
        if (!columns.has(target)) throw new Error(`Unmapped source column ${sourceName}.${name} -> ${target}`);
        row[target] = sourceName === 'Users' && name === 'UserType'
          ? String(value).toLowerCase() : normalizeValue(value);
      }
      if (targetName === 'tickets' && !row.updated_at) row.updated_at = row.created_at || new Date().toISOString();
      const names = Object.keys(row);
      const placeholders = names.map((_, i) => `$${i + 1}`);
      await client.query(`INSERT INTO tastenet."${targetName}" (${names.map(name => `"${name}"`).join(',')})
        VALUES (${placeholders.join(',')})`, Object.values(row));
    }
    if (sourceRows.length) {
      await client.query(`SELECT setval(pg_get_serial_sequence('tastenet.${targetName}', 'id'),
        (SELECT max(id) FROM tastenet."${targetName}"), true)`);
    }
    console.log(`${sourceName}: ${sourceRows.length} rows migrated`);
  }
  await client.query('COMMIT');
  console.log('BACPAC business data migration committed');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`Import failed (${error.code || 'UNKNOWN'}) in ${error.table || 'migration'}${error.column ? `.${error.column}` : ''}.`);
  process.exitCode = 1;
} finally {
  await client.end();
}
