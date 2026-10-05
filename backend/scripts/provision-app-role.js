import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import {
  applicationConnectionUrl,
  provisionApplicationRole,
} from "../src/services/application-role.js";

const environmentFile = new URL("../.env.production.local", import.meta.url);
let owner;
let app;
let transaction = false;
try {
  const contents = await readFile(environmentFile, "utf8");
  const env = dotenv.parse(contents);
  const ownerUrl = new URL(env.DATABASE_URL);
  if (!/(?:\.pooler\.supabase\.com|\.supabase\.co)$/.test(ownerUrl.hostname))
    throw new Error("Owner connection must target the Supabase project");
  ownerUrl.searchParams.set("sslmode", "verify-full");
  owner = new pg.Client({ connectionString: ownerUrl.toString() });
  await owner.connect();
  const savedUrl = env.APP_DATABASE_URL ? new URL(env.APP_DATABASE_URL) : null;
  const password = savedUrl
    ? decodeURIComponent(savedUrl.password)
    : randomBytes(32).toString("hex");
  const url = applicationConnectionUrl(ownerUrl.toString(), password);
  if (savedUrl && savedUrl.toString() !== url)
    throw new Error(
      "Saved application URL must match the owner project and use verified TLS",
    );
  const exists =
    (await owner.query("SELECT 1 FROM pg_roles WHERE rolname='tastenet_app'"))
      .rows.length > 0;
  if (exists && !savedUrl)
    throw new Error(
      "Application role exists; provide its saved APP_DATABASE_URL instead of rotating credentials",
    );
  if (!exists) {
    await owner.query("BEGIN");
    transaction = true;
    await provisionApplicationRole(owner, password);
    // Save before commit: a local write failure rolls role creation back. A
    // retry after a commit failure can recreate the role with its saved secret.
    if (!savedUrl)
      await writeFile(
        environmentFile,
        `${contents.trimEnd()}\nAPP_DATABASE_URL=${url}\n`,
        { mode: 0o600 },
      );
    await owner.query("COMMIT");
    transaction = false;
  }
  app = new pg.Client({ connectionString: url });
  await app.connect();
  if (
    (await app.query("SELECT current_user AS role")).rows[0].role !==
    "tastenet_app"
  )
    throw new Error(
      "Application connection did not use the TasteNet application role",
    );
  await app.query("SELECT count(*) FROM tastenet.users");
  console.log(
    "Limited application connection verified. Its URL is saved privately as APP_DATABASE_URL; deploy that value as DATABASE_URL.",
  );
} catch (error) {
  if (transaction) await owner.query("ROLLBACK").catch(() => {});
  console.error(
    error.code
      ? `Application role setup stopped (${error.code}); no credentials were logged.`
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([owner?.end(), app?.end()]);
}
