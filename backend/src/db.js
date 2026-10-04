import pg from "pg";

export function createPool(databaseUrl) {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
}
