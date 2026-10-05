import { createHash } from "node:crypto";

// Carry business records to the new installation, with a fresh authentication
// state. The destination migration ledger is maintained by the migration runner.
export const excludedTransferTables = new Set([
  "auth_sessions",
  "email_otps",
  "auth_challenges",
  "request_limits",
  "schema_migrations",
]);
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const relation = (table) => `tastenet.${identifier(table)}`;

async function metadata(db) {
  const result = await db.query(`SELECT table_name, column_name, udt_name,
    is_identity, is_generated FROM information_schema.columns
    WHERE table_schema='tastenet' ORDER BY table_name, ordinal_position`);
  const tables = new Map();
  for (const column of result.rows) {
    if (!tables.has(column.table_name)) tables.set(column.table_name, []);
    tables.get(column.table_name).push(column);
  }
  return tables;
}

async function tableOrder(db, names) {
  const result =
    await db.query(`SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c
    JOIN pg_class child ON child.oid=c.conrelid
    JOIN pg_class parent ON parent.oid=c.confrelid
    JOIN pg_namespace n ON n.oid=child.relnamespace
    WHERE c.contype='f' AND n.nspname='tastenet'`);
  const remaining = new Set(names);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].find((name) =>
      result.rows.every(
        (fk) =>
          fk.child !== name || fk.parent === name || !remaining.has(fk.parent),
      ),
    );
    if (!ready)
      throw new Error(
        "Cannot transfer tables with a foreign-key dependency cycle",
      );
    remaining.delete(ready);
    ordered.push(ready);
  }
  return ordered;
}

async function readRows(db, table, columns) {
  // Text casts preserve bigint/numeric precision, timestamp microseconds, JSON,
  // and bytea. node-postgres's default Date conversion would lose precision.
  return (
    await db.query(
      `SELECT ${columns
        .map(
          (c) =>
            `${identifier(c.column_name)}::text AS ${identifier(c.column_name)}`,
        )
        .join(
          ",",
        )} FROM ${relation(table)} ORDER BY ${identifier(columns[0].column_name)}`,
    )
  ).rows;
}
const digest = (rows, columns) => {
  const hash = createHash("sha256");
  for (const row of rows)
    hash.update(JSON.stringify(columns.map((c) => row[c.column_name])));
  return hash.digest("hex");
};

export async function assertEmptyDestination(db) {
  const tables = await metadata(db);
  for (const table of tables.keys()) {
    if (table === "schema_migrations") continue;
    const result = await db.query(
      `SELECT EXISTS(SELECT 1 FROM ${relation(table)}) AS populated`,
    );
    if (result.rows[0].populated) {
      throw new Error(
        `Refusing transfer: destination table ${table} already contains records`,
      );
    }
  }
}

export async function copyTasteNetData(
  source,
  target,
  { onProgress = () => {} } = {},
) {
  let sourceTransaction = false;
  let targetTransaction = false;
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransaction = true;
    await target.query("BEGIN");
    targetTransaction = true;
    await source.query("SET LOCAL TIME ZONE 'UTC'");
    await target.query("SET LOCAL TIME ZONE 'UTC'");
    await source.query("SET LOCAL bytea_output='hex'");
    await target.query("SET LOCAL bytea_output='hex'");
    const sourceTables = await metadata(source);
    const targetTables = await metadata(target);
    if (!sourceTables.has("users") || sourceTables.size !== targetTables.size) {
      throw new Error("Source and destination TasteNet schemas do not match");
    }
    for (const [name, columns] of sourceTables) {
      const signature = (items) =>
        JSON.stringify(
          items.map((c) => [
            c.column_name,
            c.udt_name,
            c.is_identity,
            c.is_generated,
          ]),
        );
      if (
        !targetTables.has(name) ||
        signature(columns) !== signature(targetTables.get(name))
      ) {
        throw new Error(`Source and destination columns differ for ${name}`);
      }
    }
    await target.query(
      `LOCK TABLE ${[...targetTables.keys()].map(relation).join(",")} IN ACCESS EXCLUSIVE MODE`,
    );
    await assertEmptyDestination(target);
    const migrations = (db) =>
      db.query(
        "SELECT name, checksum FROM tastenet.schema_migrations ORDER BY name",
      );
    const sourceMigrations = (await migrations(source)).rows;
    const targetMigrations = (await migrations(target)).rows;
    if (JSON.stringify(sourceMigrations) !== JSON.stringify(targetMigrations)) {
      throw new Error(
        "Source and destination migration checksums do not match",
      );
    }
    const names = [...sourceTables.keys()].filter(
      (name) => !excludedTransferTables.has(name),
    );
    const summary = [];
    for (const table of await tableOrder(source, names)) {
      const columns = sourceTables
        .get(table)
        .filter((c) => c.is_generated === "NEVER");
      const rows = await readRows(source, table, columns);
      const batchSize = Math.max(
        1,
        Math.min(100, Math.floor(5000 / columns.length)),
      );
      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const values = batch.flatMap((row) =>
          columns.map((c) => row[c.column_name]),
        );
        const placeholders = batch.map(
          (_, rowIndex) =>
            `(${columns.map((column, colIndex) => `$${rowIndex * columns.length + colIndex + 1}::text::pg_catalog.${identifier(column.udt_name)}`).join(",")})`,
        );
        await target.query(
          `INSERT INTO ${relation(table)} (${columns.map((c) => identifier(c.column_name)).join(",")})
          OVERRIDING SYSTEM VALUE VALUES ${placeholders.join(",")}`,
          values,
        );
      }
      const copied = await readRows(target, table, columns);
      if (
        rows.length !== copied.length ||
        digest(rows, columns) !== digest(copied, columns)
      ) {
        throw new Error(`Transfer verification failed for ${table}`);
      }
      for (const c of columns.filter(
        (column) => column.is_identity === "YES",
      )) {
        const sequence = (
          await target.query("SELECT pg_get_serial_sequence($1,$2) AS name", [
            relation(table),
            c.column_name,
          ])
        ).rows[0].name;
        const originalSequence =
          (
            await source.query(
              `SELECT last_value::text AS value
          FROM pg_sequences WHERE schemaname='tastenet' AND sequencename=(
            SELECT relname FROM pg_class WHERE oid=pg_get_serial_sequence($1,$2)::regclass)`,
              [relation(table), c.column_name],
            )
          ).rows[0]?.value ?? null;
        await target.query(
          `SELECT setval($1::regclass, GREATEST(COALESCE(MAX(${identifier(c.column_name)}),1),COALESCE($2::bigint,1)), COUNT(*)>0 OR $2::bigint IS NOT NULL) FROM ${relation(table)}`,
          [sequence, originalSequence],
        );
      }
      summary.push({ table, rows: rows.length });
      onProgress({ table, rows: rows.length });
    }
    await target.query("COMMIT");
    targetTransaction = false;
    return summary;
  } catch (error) {
    if (targetTransaction) await target.query("ROLLBACK");
    throw error;
  } finally {
    if (sourceTransaction) await source.query("ROLLBACK");
  }
}
