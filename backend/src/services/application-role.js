export function applicationConnectionUrl(ownerUrl, password) {
  const url = new URL(ownerUrl);
  const username = decodeURIComponent(url.username);
  const projectSuffix = username.includes(".")
    ? username.slice(username.indexOf("."))
    : "";
  url.username = `tastenet_app${projectSuffix}`;
  url.password = password;
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export async function provisionApplicationRole(owner, password) {
  if (!/^[a-f0-9]{64}$/.test(password))
    throw new Error("Expected a generated 32-byte application password");
  if (
    (await owner.query("SELECT 1 FROM pg_roles WHERE rolname='tastenet_app'"))
      .rows.length
  )
    throw new Error(
      "TasteNet application role already exists; reuse its private APP_DATABASE_URL",
    );
  // The generated password is hexadecimal only; PostgreSQL role DDL cannot use
  // a bind parameter here. It is never logged or returned from this function.
  await owner.query(`CREATE ROLE tastenet_app LOGIN PASSWORD '${password}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
  await owner.query("GRANT USAGE ON SCHEMA tastenet TO tastenet_app");
  await owner.query(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA tastenet TO tastenet_app",
  );
  await owner.query(
    "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA tastenet TO tastenet_app",
  );
  await owner.query(
    "REVOKE ALL ON tastenet.schema_migrations FROM tastenet_app",
  );
  await owner.query(
    "ALTER DEFAULT PRIVILEGES IN SCHEMA tastenet GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO tastenet_app",
  );
  await owner.query(
    "ALTER DEFAULT PRIVILEGES IN SCHEMA tastenet GRANT USAGE,SELECT ON SEQUENCES TO tastenet_app",
  );
}
