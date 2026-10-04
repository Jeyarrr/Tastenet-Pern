import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { readConfig } from "../src/config.js";
import { migrate } from "../src/migrations.js";

const url = new URL(readConfig().DATABASE_URL);
if (url.pathname !== "/tastenet") {
  throw new Error(
    "Refusing setup: DATABASE_URL must target the tastenet database",
  );
}
const ownerUrl = new URL(url);
ownerUrl.pathname = "/postgres";
const owner = new pg.Client({ connectionString: ownerUrl.toString() });
await owner.connect();
try {
  const existing = await owner.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["tastenet"],
  );
  if (!existing.rowCount) {
    await owner.query("CREATE DATABASE tastenet");
    console.log("Created local tastenet database");
  } else {
    console.log("Using existing local tastenet database");
  }
} finally {
  await owner.end();
}

const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../database",
  );
  await db.query(await readFile(path.join(root, "schema.sql"), "utf8"));
  await migrate({
    query: (...args) => db.query(...args),
    connect: async () => ({
      query: (...args) => db.query(...args),
      release() {},
    }),
  });
  const existing = await db.query(`SELECT
    (SELECT count(*)::int FROM tastenet.users) +
    (SELECT count(*)::int FROM tastenet.menu) +
    (SELECT count(*)::int FROM tastenet.inventory) +
    (SELECT count(*)::int FROM tastenet.tickets) AS records`);
  if (existing.rows[0].records === 0) {
    await db.query(await readFile(path.join(root, "seed.sql"), "utf8"));
    console.log("Inserted synthetic starter records");
  }
  const result = await db.query(
    "SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'tastenet'",
  );
  console.log(`TasteNet schema ready: ${result.rows[0].tables} tables`);
} finally {
  await db.end();
}
