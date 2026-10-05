import pg from "pg";

export function createPool(databaseUrl, options = {}) {
  const url = new URL(databaseUrl);
  // Supabase connections always use verified TLS, including the shared pooler.
  if (/(?:\.pooler\.supabase\.com|\.supabase\.co)$/.test(url.hostname))
    url.searchParams.set("sslmode", "verify-full");
  return new pg.Pool({
    connectionString: url.toString(),
    max: 10,
    connectionTimeoutMillis: 5000,
    ...options,
  });
}
