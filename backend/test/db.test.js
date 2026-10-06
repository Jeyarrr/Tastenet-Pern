import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { X509Certificate } from "node:crypto";
import { connectionOptions } from "../src/db.js";

test("Supabase TLS retains its trusted CA when URL SSL settings are present", () => {
  const options = connectionOptions(
    "postgresql://sample:sample@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=disable&sslrootcert=missing.crt&ssl=false",
  );
  const client = new pg.Client(options);
  assert.equal(client.ssl.rejectUnauthorized, true);
  assert.equal(new X509Certificate(client.ssl.ca).ca, true);
  assert.equal(client.connectionParameters.port, 6543);
});

test("local PostgreSQL connections retain their existing configuration", () => {
  const url = "postgresql://sample:sample@localhost:5432/tastenet";
  assert.equal(connectionOptions(url).connectionString, url);
  assert.equal(connectionOptions(url).ssl, undefined);
});
