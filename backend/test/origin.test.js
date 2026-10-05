import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";

test("development login origins include Vite fallback ports; production stays restricted", async () => {
  for (const mode of ["development", "production"]) {
    const configuredOrigin = "https://tastenet.example.test";
    const server = createApp({
      db: {},
      config: { NODE_ENV: mode, CLIENT_ORIGIN: configuredOrigin },
    }).listen(0);
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const localOrigins = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ];
    const rejectedOrigins = [
      "https://evil.example",
      "http://localhost.evil.example:5174",
      "http://localhost:5175",
      "null",
    ];
    try {
      for (const origin of [
        configuredOrigin,
        ...localOrigins,
        ...rejectedOrigins,
      ]) {
        const allowed =
          origin === configuredOrigin ||
          (mode === "development" && localOrigins.includes(origin));
        // An empty login body reaches validation only after its origin is accepted.
        const response = await fetch(`${base}/api/auth/login`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: "{}",
        });
        assert.equal(
          response.status,
          allowed ? 400 : 403,
          `${mode}: ${origin}`,
        );
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          allowed ? origin : null,
        );
        assert.equal(
          (await response.json()).error.code,
          allowed ? "VALIDATION_ERROR" : "ORIGIN_DENIED",
        );
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
