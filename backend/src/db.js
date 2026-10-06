import pg from "pg";
import { readFileSync } from "node:fs";

export function connectionOptions(databaseUrl) {
  const url = new URL(databaseUrl);
  if (/(?:\.pooler\.supabase\.com|\.supabase\.co)$/.test(url.hostname)) {
    // pg URL SSL parameters replace the explicit ssl object, including its CA.
    for (const key of [
      "sslmode",
      "sslcert",
      "sslkey",
      "sslrootcert",
      "ssl",
      "uselibpqcompat",
    ])
      url.searchParams.delete(key);
    return {
      connectionString: url.toString(),
      connectionTimeoutMillis: 10000,
      ssl: {
        ca: readFileSync(
          new URL("./certificates/supabase-ca.crt", import.meta.url),
          "utf8",
        ),
        rejectUnauthorized: true,
      },
    };
  }
  return { connectionString: url.toString(), connectionTimeoutMillis: 10000 };
}

export function createPool(databaseUrl, options = {}) {
  return new pg.Pool({
    max: 10,
    ...options,
    ...connectionOptions(databaseUrl),
  });
}
