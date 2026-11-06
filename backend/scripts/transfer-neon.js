import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";
import { connectionOptions } from "../src/db.js";
import { migrate } from "../src/migrations.js";
import {
  assertEmptyDestination,
  copyTasteNetData,
} from "../src/services/database-transfer.js";

// Source selection is explicit; never silently fall back to stale local records.
const args = process.argv.slice(2);
let source;
let target;
try {
  if (
    args.some(
      (arg) =>
        !["--local-source", "--supabase-source", "--apply"].includes(arg),
    ) ||
    args.includes("--local-source") === args.includes("--supabase-source")
  )
    throw new Error(
      "Choose exactly one source: --supabase-source or --local-source; add --apply only after preview.",
    );
  const localSource = args.includes("--local-source");
  const sourceEnv = dotenv.parse(
    await readFile(
      new URL(
        localSource ? "../.env" : "../.env.production.local",
        import.meta.url,
      ),
    ),
  );
  const targetEnv = dotenv.parse(
    await readFile(new URL("../.env.neon.local", import.meta.url)),
  );
  const sourceUrl = new URL(sourceEnv.DATABASE_URL);
  const targetUrl = new URL(targetEnv.DIRECT_DATABASE_URL);
  if (
    localSource
      ? !["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname)
      : !/(?:\.pooler\.supabase\.com|\.supabase\.co)$/.test(sourceUrl.hostname)
  )
    throw new Error(
      "Source URL does not match the explicitly selected database provider.",
    );
  if (
    !/^postgres(?:ql)?:$/.test(targetUrl.protocol) ||
    !targetUrl.hostname.endsWith(".neon.tech") ||
    targetUrl.hostname.includes("-pooler.")
  )
    throw new Error(
      "DIRECT_DATABASE_URL must be a direct (non-pooled) Neon PostgreSQL owner connection.",
    );
  source = new pg.Client({
    ...connectionOptions(sourceUrl.toString()),
    query_timeout: 60000,
  });
  target = new pg.Client({
    ...connectionOptions(targetUrl.toString()),
    query_timeout: 60000,
  });
  source.on("error", () => {});
  target.on("error", () => {});
  await source.connect();
  await target.connect();
  // Fail before creating anything if the source has no TasteNet schema.
  const result = await source.query(
    "SELECT to_regclass('tastenet.users') AS users",
  );
  if (!result.rows[0].users)
    throw new Error("Source has no TasteNet users table.");
  await assertEmptyDestination(target);
  if (!args.includes("--apply")) {
    console.log(
      "Both connections verified. Destination is empty. No records changed. Add --apply to copy after confirming the source.",
    );
  } else {
    await target.query(
      await readFile(
        new URL("../../database/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await migrate({
      query: (...values) => target.query(...values),
      connect: async () => ({
        query: (...values) => target.query(...values),
        release() {},
      }),
    });
    const summary = await copyTasteNetData(source, target, {
      onProgress: ({ table, rows }) =>
        console.log(`Verified ${table}: ${rows} records`),
    });
    console.log(
      `Committed ${summary.length} verified business tables. Source was read only; sessions and OTPs were excluded.`,
    );
  }
} catch (error) {
  // Driver diagnostics can contain private row values or connection strings.
  console.error(
    error.code
      ? `Transfer stopped (${error.code}); private diagnostics omitted.`
      : error.message.replace(
          /postgres(?:ql)?:\/\/\S+/g,
          "[redacted connection]",
        ),
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source?.end(), target?.end()]);
}
