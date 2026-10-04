import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { transaction } from "./services/transaction.js";

const directory = fileURLToPath(
  new URL("../../database/migrations/", import.meta.url),
);
export async function migrate(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS tastenet.schema_migrations (
    name text PRIMARY KEY, checksum char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`${directory}/${name}`, "utf8");
    const checksum = createHash("sha256")
      .update(sql.replace(/\r\n/g, "\n"))
      .digest("hex");
    const previous = await db.query(
      "SELECT checksum FROM tastenet.schema_migrations WHERE name=$1",
      [name],
    );
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await transaction(db, async (client) => {
      await client.query(sql);
      await client.query(
        "INSERT INTO tastenet.schema_migrations(name,checksum) VALUES ($1,$2)",
        [name, checksum],
      );
    });
  }
}
