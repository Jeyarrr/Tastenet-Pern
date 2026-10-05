import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";
import { readConfig } from "../src/config.js";
import { migrate } from "../src/migrations.js";
import {
  assertEmptyDestination,
  copyTasteNetData,
} from "../src/services/database-transfer.js";

// The local .env is the source. Production credentials are read separately and
// never replace the local development configuration or appear in output.
let source;
let target;
try {
  const local = dotenv.parse(
    await readFile(new URL("../.env", import.meta.url)),
  );
  const production = dotenv.parse(
    await readFile(new URL("../.env.production.local", import.meta.url)),
  );
  const sourceUrl = new URL(
    readConfig({ ...local, NODE_ENV: "development" }).DATABASE_URL,
  );
  const destinationUrl = new URL(production.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname))
    throw new Error(
      "Source must be the local PostgreSQL server in backend/.env",
    );
  if (
    !/^postgres(?:ql)?:$/.test(destinationUrl.protocol) ||
    !/(?:\.pooler\.supabase\.com|\.supabase\.co)$/.test(destinationUrl.hostname)
  )
    throw new Error(
      "Destination must be the Supabase project PostgreSQL connection URL",
    );
  destinationUrl.searchParams.set("sslmode", "verify-full");
  source = new pg.Client({ connectionString: sourceUrl.toString() });
  target = new pg.Client({ connectionString: destinationUrl.toString() });
  await source.connect();
  await target.connect();
  await assertEmptyDestination(target);
  if (!process.argv.includes("--apply")) {
    console.log(
      "Destination is empty. Preview passed; use --apply to install the schema and transfer records.",
    );
  } else {
    await target.query(
      await readFile(
        new URL("../../database/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await migrate({
      query: (...args) => target.query(...args),
      connect: async () => ({
        query: (...args) => target.query(...args),
        release() {},
      }),
    });
    const summary = await copyTasteNetData(source, target, {
      onProgress: ({ table, rows }) =>
        console.log(`Verified ${table}: ${rows} records`),
    });
    console.log(
      `Transfer committed: ${summary.length} business tables verified. Local records were read only. Sessions and OTPs were not copied.`,
    );
  }
} catch (error) {
  // Database errors may include a failing row (personal data); emit only a code.
  if (error.code)
    console.error(
      `Transfer stopped (${error.code}); no row contents were logged.`,
    );
  else
    console.error(
      error.message.replace(
        /postgres(?:ql)?:\/\/\S+/g,
        "[redacted connection]",
      ),
    );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source?.end(), target?.end()]);
}
