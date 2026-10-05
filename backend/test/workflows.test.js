import test from "node:test";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { createSession } from "../src/services/sessions.js";
import { migrate } from "../src/migrations.js";

const config = {
  NODE_ENV: "test",
  CLIENT_ORIGIN: "http://localhost:5173",
  SESSION_DAYS: 7,
  SESSION_COOKIE_NAME: "test_session",
  EMAIL_VERIFICATION_REQUIRED: true,
  GOOGLE_CLIENT_ID: "sample-client",
  GOOGLE_CLIENT_SECRET: "test-only",
  GOOGLE_REDIRECT_URI: "http://localhost:5173/api/auth/google/callback",
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=",
  "base64",
);
test("restored workflows use transactions, ownership and provider validation", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    await readFile(
      new URL("../../database/schema.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(new URL("../../database/seed.sql", import.meta.url), "utf8"),
  );
  db.connect = async () => ({
    query: (sql, params) =>
      !params && sql.includes(";") ? db.exec(sql) : db.query(sql, params),
    release() {},
  });
  await migrate(db);
  const messages = [];
  let googleRequest,
    wrongNonce = false;
  const google = {
    generateCodeVerifierAsync: async () => ({
      codeVerifier: "test-verifier",
      codeChallenge: "test-challenge",
    }),
    generateAuthUrl: (options) => {
      googleRequest = options;
      return `https://accounts.google.com/test?state=${options.state}`;
    },
    getToken: async ({ codeVerifier }) => {
      assert.equal(codeVerifier, "test-verifier");
      return { tokens: { id_token: "test-token" } };
    },
    verifyIdToken: async (options) => {
      assert.equal(options.audience, config.GOOGLE_CLIENT_ID);
      return {
        getPayload: () => ({
          email: "google@example.test",
          sub: "google-test-subject",
          name: "Google Sample",
          email_verified: true,
          nonce: wrongNonce ? "wrong" : googleRequest.nonce,
        }),
      };
    },
  };
  const server = createApp({
    db,
    config,
    authDependencies: {
      sendEmail: async (mail) => messages.push(mail),
      google,
    },
  }).listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (
    path,
    { method = "GET", body, cookie, raw, type } = {},
  ) => {
    const r = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        origin: config.CLIENT_ORIGIN,
        ...(cookie ? { cookie } : {}),
        "content-type": type || "application/json",
      },
      body: raw || (body === undefined ? undefined : JSON.stringify(body)),
    });
    return {
      status: r.status,
      data: await r.json().catch(() => null),
      cookie: r.headers.get("set-cookie"),
      location: r.headers.get("location"),
    };
  };
  const expectStatus = (r, status) => {
    assert.equal(r.status, status, JSON.stringify(r.data));
    return r.data;
  };
  const accounts = {};
  const accountPassword = "Synthetic-Account-123!";
  const accountHash = await bcrypt.hash(accountPassword, 4);
  for (const role of ["customer", "admin", "rider", "superadmin"]) {
    const u = (
      await db.query(
        `INSERT INTO tastenet.users(username,email,full_name,role,password_hash) VALUES ($1,$2,$1,$3,$4) RETURNING id`,
        [`test_${role}`, `${role}@example.test`, role, accountHash],
      )
    ).rows[0];
    accounts[role] = {
      id: u.id,
      cookie: `${config.SESSION_COOKIE_NAME}=${await createSession(db, u.id, config)}`,
    };
  }
  const menu = (await db.query("SELECT id FROM tastenet.menu LIMIT 1")).rows[0];
  const ingredient = (
    await db.query("SELECT id,current_stock FROM tastenet.inventory LIMIT 1")
  ).rows[0];
  let order, proof, document;
  const input = {
    items: [{ menuId: menu.id, quantity: 2, specialInstructions: "No chili" }],
    deliveryAddress: "123 Sample Street",
    barangayName: "Sample Barangay A",
    paymentMethod: "Cash on Delivery",
    requestKey: randomUUID(),
    instructions: "Call on arrival",
  };
  try {
    await t.test(
      "duplicate checkout, details privacy and invalid transitions",
      async () => {
        order = expectStatus(
          await call("/api/orders", {
            method: "POST",
            cookie: accounts.customer.cookie,
            body: input,
          }),
          201,
        ).order;
        assert.equal(
          expectStatus(
            await call("/api/orders", {
              method: "POST",
              cookie: accounts.customer.cookie,
              body: input,
            }),
            201,
          ).order.id,
          order.id,
        );
        assert.equal(
          (await db.query("SELECT count(*)::int n FROM tastenet.tickets"))
            .rows[0].n,
          1,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/details`, {
            cookie: accounts.rider.cookie,
          }),
          403,
        );
        const details = expectStatus(
          await call(`/api/orders/${order.id}/details`, {
            cookie: accounts.customer.cookie,
          }),
          200,
        );
        assert.equal(details.items[0].special_instructions, "No chili");
        assert.equal(details.order.special_instructions, "Call on arrival");
        expectStatus(
          await call(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { status: "Completed" },
          }),
          409,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/priority`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { priority: "Rush" },
          }),
          200,
        );
      },
    );
    await t.test(
      "insufficient stock rolls back all deductions; preparation deducts exactly once",
      async () => {
        const extra = (
          await db.query(
            "INSERT INTO tastenet.inventory(item_code,item_name,unit_of_measure,current_stock) VALUES ('EMPTY','Empty ingredient','kg',0) RETURNING id",
          )
        ).rows[0];
        await db.query(
          "INSERT INTO tastenet.menu_recipe_ingredients(menu_id,inventory_id,quantity_required) VALUES ($1,$2,.5),($1,$3,1)",
          [menu.id, ingredient.id, extra.id],
        );
        expectStatus(
          await call(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { status: "In Progress" },
          }),
          409,
        );
        assert.equal(
          Number(
            (
              await db.query(
                "SELECT current_stock FROM tastenet.inventory WHERE id=$1",
                [ingredient.id],
              )
            ).rows[0].current_stock,
          ),
          Number(ingredient.current_stock),
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM tastenet.inventory_transactions",
            )
          ).rows[0].n,
          0,
        );
        await db.query(
          "UPDATE tastenet.inventory SET current_stock=10 WHERE id=$1",
          [extra.id],
        );
        expectStatus(
          await call(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { status: "In Progress" },
          }),
          200,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { status: "In Progress" },
          }),
          409,
        );
        assert.equal(
          Number(
            (
              await db.query(
                "SELECT current_stock FROM tastenet.inventory WHERE id=$1",
                [ingredient.id],
              )
            ).rows[0].current_stock,
          ),
          Number(ingredient.current_stock) - 1,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM tastenet.inventory_transactions",
            )
          ).rows[0].n,
          2,
        );
      },
    );
    await t.test(
      "file validation, order proof ownership, required delivery proof and one rating",
      async () => {
        expectStatus(
          await call("/api/files?purpose=menu", {
            method: "POST",
            cookie: accounts.customer.cookie,
            raw: png,
            type: "image/png",
          }),
          403,
        );
        expectStatus(
          await call("/api/files?purpose=menu", {
            method: "POST",
            cookie: accounts.admin.cookie,
            raw: Buffer.from("not a png"),
            type: "image/png",
          }),
          400,
        );
        const payment = expectStatus(
          await call(`/api/files?purpose=payment-proof&ticketId=${order.id}`, {
            method: "POST",
            cookie: accounts.customer.cookie,
            raw: png,
            type: "image/png",
          }),
          201,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/payment-proof`, {
            method: "POST",
            cookie: accounts.customer.cookie,
            body: { url: payment.url },
          }),
          201,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/assign`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { riderId: accounts.rider.id },
          }),
          200,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            cookie: accounts.rider.cookie,
            body: { status: "Completed", proofUrl: payment.url },
          }),
          403,
        );
        proof = expectStatus(
          await call(`/api/files?purpose=delivery-proof&ticketId=${order.id}`, {
            method: "POST",
            cookie: accounts.rider.cookie,
            raw: png,
            type: "image/png",
          }),
          201,
        );
        assert.equal((await fetch(base + proof.url)).status, 401);
        assert.equal(
          (
            await fetch(base + proof.url, {
              headers: { cookie: accounts.customer.cookie },
            })
          ).status,
          200,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/status`, {
            method: "PATCH",
            cookie: accounts.rider.cookie,
            body: { status: "Completed", proofUrl: proof.url },
          }),
          200,
        );
        const details = expectStatus(
          await call(`/api/orders/${order.id}/details`, {
            cookie: accounts.customer.cookie,
          }),
          200,
        );
        assert.equal(details.history.length, 2);
        assert.equal(details.proofs.length, 2);
        expectStatus(
          await call(`/api/orders/${order.id}/rating`, {
            method: "POST",
            cookie: accounts.customer.cookie,
            body: { rating: 4, comment: "Sample feedback" },
          }),
          201,
        );
        expectStatus(
          await call(`/api/orders/${order.id}/rating`, {
            method: "POST",
            cookie: accounts.customer.cookie,
            body: { rating: 5 },
          }),
          409,
        );
        assert.equal(
          (
            await db.query(
              "SELECT rating_count FROM tastenet.menu WHERE id=$1",
              [menu.id],
            )
          ).rows[0].rating_count,
          1,
        );
      },
    );
    await t.test(
      "WebP upload validation and customer/rider profile photos in management",
      async () => {
        const webp = Buffer.from(
          "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v02aAA=",
          "base64",
        );
        expectStatus(
          await call("/api/files?purpose=profile", {
            method: "POST",
            cookie: accounts.customer.cookie,
            raw: png,
            type: "image/webp",
          }),
          400,
        );
        for (const role of ["customer", "rider"]) {
          const photo = expectStatus(
            await call("/api/files?purpose=profile", {
              method: "POST",
              cookie: accounts[role].cookie,
              raw: webp,
              type: "image/webp",
            }),
            201,
          );
          // Cover both current profile_photo and the original profile_picture field.
          await db.query(
            "UPDATE tastenet.users SET profile_photo=$1,profile_picture=$2 WHERE id=$3",
            [role === "rider" ? photo.url : "", photo.url, accounts[role].id],
          );
          const listing = expectStatus(
            await call("/api/manage/users", {
              cookie: accounts.superadmin.cookie,
            }),
            200,
          );
          assert.equal(
            listing.items.find(
              (person) => String(person.id) === String(accounts[role].id),
            ).profile_photo,
            photo.url,
          );
          const details = expectStatus(
            await call(`/api/manage/users/${accounts[role].id}/details`, {
              cookie: accounts.superadmin.cookie,
            }),
            200,
          );
          assert.equal(details.user.profile_photo, photo.url);
          const image = await fetch(base + photo.url, {
            headers: { cookie: accounts.superadmin.cookie },
          });
          assert.equal(image.status, 200);
          assert.equal(image.headers.get("content-type"), "image/webp");
          assert.deepEqual(Buffer.from(await image.arrayBuffer()), webp);
          assert.equal((await fetch(base + photo.url)).status, 401);
        }
      },
    );
    await t.test(
      "rider vehicle, private documents, review, payment methods and quotas",
      async () => {
        const vehicle = {
          vehicle: "Motorcycle",
          vehicleModel: "Sample",
          vehicleYear: "2025",
          licensePlate: "TEST-1",
          vehicleColor: "Red",
          licenseNumber: "SAMPLE",
          nbiNumber: "",
          orcrNumber: "",
          insurancePolicy: "",
          insuranceDate: "",
        };
        expectStatus(
          await call("/api/auth/vehicle", {
            method: "PATCH",
            cookie: accounts.rider.cookie,
            body: { ...vehicle, currentPassword: accountPassword },
          }),
          200,
        );
        document = expectStatus(
          await call("/api/files?purpose=rider-document", {
            method: "POST",
            cookie: accounts.rider.cookie,
            raw: png,
            type: "image/png",
          }),
          201,
        );
        expectStatus(
          await call("/api/auth/documents/driver_license_photo", {
            method: "PUT",
            cookie: accounts.rider.cookie,
            body: { url: document.url, currentPassword: accountPassword },
          }),
          200,
        );
        assert.equal(
          (
            await fetch(base + document.url, {
              headers: { cookie: accounts.customer.cookie },
            })
          ).status,
          403,
        );
        expectStatus(
          await call(
            `/api/manage/users/${accounts.rider.id}/documents/driver_license_photo`,
            {
              method: "PATCH",
              cookie: accounts.superadmin.cookie,
              body: { status: "approved", notes: "Test review" },
            },
          ),
          200,
        );
        assert.equal(
          expectStatus(
            await call("/api/auth/documents", {
              cookie: accounts.rider.cookie,
            }),
            200,
          ).items[0].status,
          "approved",
        );
        assert.equal(
          expectStatus(
            await call(`/api/manage/users/${accounts.rider.id}/details`, {
              cookie: accounts.superadmin.cookie,
            }),
            200,
          ).orders.length,
          1,
        );
        const payment = {
          name: "Sample Wallet",
          isEnabled: true,
          instructions: "Sample",
          accountDetails: "Sample account",
          displayOrder: 3,
        };
        const created = expectStatus(
          await call("/api/manage/payment-methods", {
            method: "POST",
            cookie: accounts.superadmin.cookie,
            body: payment,
          }),
          201,
        );
        expectStatus(
          await call(`/api/manage/payment-methods/${created.method.id}`, {
            method: "PUT",
            cookie: accounts.superadmin.cookie,
            body: { ...payment, name: "Updated Wallet" },
          }),
          200,
        );
        expectStatus(
          await call(`/api/manage/payment-methods/${created.method.id}`, {
            method: "DELETE",
            cookie: accounts.superadmin.cookie,
          }),
          204,
        );
        expectStatus(
          await call("/api/manage/quotas", {
            method: "POST",
            cookie: accounts.superadmin.cookie,
            body: {
              type: "Weekly",
              targetAmount: 1000,
              startDate: "2026-10-01",
              endDate: "2026-10-07",
            },
          }),
          200,
        );
        expectStatus(
          await call("/api/manage/quotas", {
            method: "POST",
            cookie: accounts.superadmin.cookie,
            body: {
              type: "Weekly",
              targetAmount: 1000,
              startDate: "2026-10-07",
              endDate: "2026-10-01",
            },
          }),
          400,
        );
        const transactions = expectStatus(
          await call("/api/manage/transactions", {
            cookie: accounts.superadmin.cookie,
          }),
          200,
        ).items;
        expectStatus(
          await call(`/api/manage/transactions/${transactions[0].id}`, {
            cookie: accounts.superadmin.cookie,
          }),
          200,
        );
        const empty = expectStatus(
          await call("/api/manage/dashboard?from=2000-01-01&to=2000-01-02", {
            cookie: accounts.superadmin.cookie,
          }),
          200,
        );
        assert.equal(empty.topMeals.length, 0);
        assert.equal(empty.revenue.length, 0);
      },
    );
    await t.test(
      "registration OTP, wrong code, replay rejection, reset and revoked sessions",
      async () => {
        const registration = {
          username: "verified_sample",
          email: "verified@example.test",
          fullName: "Verified Sample",
          password: "Long-synthetic-password1!",
        };
        expectStatus(
          await call("/api/auth/register", {
            method: "POST",
            body: registration,
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/register/request-otp", {
            method: "POST",
            body: registration,
          }),
          200,
        );
        const code = messages.at(-1).code;
        expectStatus(
          await call("/api/auth/register/verify", {
            method: "POST",
            body: { email: registration.email, code: "000000" },
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/register/verify", {
            method: "POST",
            body: { email: registration.email, code },
          }),
          201,
        );
        expectStatus(
          await call("/api/auth/register/verify", {
            method: "POST",
            body: { email: registration.email, code },
          }),
          400,
        );
        const login = await call("/api/auth/login", {
          method: "POST",
          body: {
            identifier: registration.email,
            password: registration.password,
          },
        });
        expectStatus(login, 200);
        const cookie = login.cookie.split(";")[0];
        expectStatus(
          await call("/api/auth/password/request-otp", {
            method: "POST",
            body: { email: registration.email },
          }),
          200,
        );
        const reset = {
          email: registration.email,
          code: messages.at(-1).code,
          password: "New-synthetic-password2!",
        };
        expectStatus(
          await call("/api/auth/password/reset", {
            method: "POST",
            body: reset,
          }),
          200,
        );
        expectStatus(await call("/api/auth/me", { cookie }), 401);
        expectStatus(
          await call("/api/auth/password/reset", {
            method: "POST",
            body: reset,
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/login", {
            method: "POST",
            body: { identifier: registration.email, password: reset.password },
          }),
          200,
        );
        for (let i = 0; i < 3; i++)
          expectStatus(
            await call("/api/auth/password/request-otp", {
              method: "POST",
              body: { email: "missing@example.test" },
            }),
            200,
          );
        expectStatus(
          await call("/api/auth/password/request-otp", {
            method: "POST",
            body: { email: "missing@example.test" },
          }),
          429,
        );
      },
    );
    await t.test(
      "Google state, PKCE, nonce, customer session, and replay protection with fake provider",
      async () => {
        const start = await call("/api/auth/google");
        assert.equal(start.status, 302);
        const state = googleRequest.state,
          cookie = start.cookie.split(";")[0];
        assert.equal(googleRequest.code_challenge_method, "S256");
        const bad = await call(
          `/api/auth/google/callback?state=wrong&code=test`,
          { cookie },
        );
        assert.match(bad.location, /error=google/);
        const callback = `/api/auth/google/callback?state=${state}&code=test`;
        const accepted = await call(callback, { cookie });
        assert.equal(accepted.location, config.CLIENT_ORIGIN + "/customer");
        assert.match(accepted.cookie, /test_session=/);
        assert.match(
          (await call(callback, { cookie })).location,
          /error=google/,
        );
        const again = await call("/api/auth/google");
        wrongNonce = true;
        assert.match(
          (
            await call(
              `/api/auth/google/callback?state=${googleRequest.state}&code=test`,
              { cookie: again.cookie.split(";")[0] },
            )
          ).location,
          /error=google/,
        );
      },
    );
    await t.test(
      "customer receipt confirmation preserves ownership and preparation rules",
      async () => {
        const received = expectStatus(
          await call("/api/orders", {
            method: "POST",
            cookie: accounts.customer.cookie,
            body: { ...input, requestKey: randomUUID() },
          }),
          201,
        ).order;
        expectStatus(
          await call(`/api/orders/${received.id}/status`, {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: { status: "Completed" },
          }),
          403,
        );
        expectStatus(
          await call(`/api/orders/${received.id}/status`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { status: "In Progress" },
          }),
          200,
        );
        expectStatus(
          await call(`/api/orders/${received.id}/status`, {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: { status: "Completed" },
          }),
          200,
        );
        expectStatus(
          await call(`/api/orders/${received.id}/status`, {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: { status: "Completed" },
          }),
          403,
        );
      },
    );
    await t.test(
      "OTP attempt limits and expiry reject otherwise valid codes",
      async () => {
        const v = {
          username: "locked_sample",
          email: "locked@example.test",
          fullName: "Sample",
          password: "Long-synthetic-password1!",
        };
        expectStatus(
          await call("/api/auth/register/request-otp", {
            method: "POST",
            body: v,
          }),
          200,
        );
        const code = messages.at(-1).code;
        for (let i = 0; i < 5; i++)
          expectStatus(
            await call("/api/auth/register/verify", {
              method: "POST",
              body: { email: v.email, code: "000000" },
            }),
            400,
          );
        expectStatus(
          await call("/api/auth/register/verify", {
            method: "POST",
            body: { email: v.email, code },
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/register/request-otp", {
            method: "POST",
            body: {
              ...v,
              username: "expired_sample",
              email: "expired@example.test",
            },
          }),
          200,
        );
        await db.query(
          "UPDATE tastenet.email_otps SET expires_at=now()-interval '1 second' WHERE email=$1",
          ["expired@example.test"],
        );
        expectStatus(
          await call("/api/auth/register/verify", {
            method: "POST",
            body: { email: "expired@example.test", code: messages.at(-1).code },
          }),
          400,
        );
      },
    );
    await t.test(
      "profile edits require the account password and preserve details on rejection",
      async () => {
        const before = (
          await db.query("SELECT * FROM tastenet.users WHERE id=$1", [
            accounts.customer.id,
          ])
        ).rows[0];
        const body = {
          fullName: "Updated Customer",
          email: "updated-customer@example.test",
          phone: "+639123456789",
          addressDetails: {
            houseNumber: "12",
            street: "Sample Street",
            barangay: "Sample Barangay A",
          },
        };
        expectStatus(
          await call("/api/auth/profile", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body,
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/profile", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: { ...body, currentPassword: "wrong" },
          }),
          403,
        );
        assert.equal(
          (
            await db.query("SELECT email FROM tastenet.users WHERE id=$1", [
              accounts.customer.id,
            ])
          ).rows[0].email,
          before.email,
        );
        const saved = expectStatus(
          await call("/api/auth/profile", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: { ...body, currentPassword: accountPassword },
          }),
          200,
        );
        assert.equal(saved.profile.email, body.email);
        assert.equal(saved.profile.phone, body.phone);
        assert.deepEqual(saved.profile.address_details, body.addressDetails);
        assert.equal(
          saved.profile.address,
          "12, Sample Street, Sample Barangay A, Dasmariñas, Cavite",
        );
        assert.equal("gender" in saved.profile, false);
        expectStatus(
          await call("/api/auth/profile", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: {
              ...body,
              email: "rider@example.test",
              currentPassword: accountPassword,
            },
          }),
          409,
        );
        expectStatus(
          await call("/api/auth/profile", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: {
              ...body,
              addressDetails: {
                ...body.addressDetails,
                barangay: "Not a service barangay",
              },
              currentPassword: accountPassword,
            },
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/photo", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: { url: document.url },
          }),
          400,
        );
        expectStatus(
          await call("/api/auth/profile", {
            method: "PATCH",
            cookie: accounts.customer.cookie,
            body: {
              ...body,
              photoUrl: document.url,
              currentPassword: accountPassword,
            },
          }),
          403,
        );
        assert.equal(
          (
            await db.query("SELECT email FROM tastenet.users WHERE id=$1", [
              accounts.customer.id,
            ])
          ).rows[0].email,
          body.email,
        );
        expectStatus(
          await call(`/api/manage/users/${accounts.customer.id}`, {
            method: "PATCH",
            cookie: accounts.superadmin.cookie,
            body: {
              fullName: body.fullName,
              email: body.email,
              phone: body.phone,
              address: "Updated by store owner",
              vehicle: "",
              vehicleModel: "",
              licensePlate: "",
            },
          }),
          200,
        );
        const changed = (
          await db.query(
            "SELECT address,address_details FROM tastenet.users WHERE id=$1",
            [accounts.customer.id],
          )
        ).rows[0];
        assert.equal(changed.address, "Updated by store owner");
        assert.equal(
          changed.address_details,
          null,
          "Do not show stale structured fields after an owner changes the address",
        );
      },
    );
    await t.test(
      "superadmin password protects customer, rider and staff deactivation and revokes sessions",
      async () => {
        for (const role of ["customer", "rider", "admin"]) {
          const path = `/api/manage/users/${accounts[role].id}/active`;
          expectStatus(
            await call(path, {
              method: "PATCH",
              cookie: accounts.superadmin.cookie,
              body: { isActive: false },
            }),
            400,
          );
          expectStatus(
            await call(path, {
              method: "PATCH",
              cookie: accounts.superadmin.cookie,
              body: { isActive: false, currentPassword: "wrong" },
            }),
            403,
          );
          assert.equal(
            (
              await db.query(
                "SELECT is_active FROM tastenet.users WHERE id=$1",
                [accounts[role].id],
              )
            ).rows[0].is_active,
            true,
          );
          expectStatus(
            await call(path, {
              method: "PATCH",
              cookie: accounts.superadmin.cookie,
              body: { isActive: false, currentPassword: accountPassword },
            }),
            200,
          );
          expectStatus(
            await call("/api/auth/me", { cookie: accounts[role].cookie }),
            401,
          );
          expectStatus(
            await call(path, {
              method: "PATCH",
              cookie: accounts.superadmin.cookie,
              body: { isActive: true, currentPassword: accountPassword },
            }),
            200,
          );
          expectStatus(
            await call("/api/auth/me", { cookie: accounts[role].cookie }),
            401,
          );
          accounts[role].cookie =
            `${config.SESSION_COOKIE_NAME}=${await createSession(db, accounts[role].id, config)}`;
        }
        expectStatus(
          await call(`/api/manage/users/${accounts.customer.id}/active`, {
            method: "PATCH",
            cookie: accounts.admin.cookie,
            body: { isActive: false, currentPassword: accountPassword },
          }),
          403,
        );
      },
    );
    await t.test("archive preserves records but revokes access", async () => {
      expectStatus(
        await call(`/api/manage/users/${accounts.rider.id}`, {
          method: "DELETE",
          cookie: accounts.superadmin.cookie,
          body: { currentPassword: accountPassword },
        }),
        204,
      );
      expectStatus(
        await call("/api/auth/me", { cookie: accounts.rider.cookie }),
        401,
      );
      expectStatus(
        await call(`/api/orders/${order.id}`, {
          method: "DELETE",
          cookie: accounts.admin.cookie,
        }),
        204,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM tastenet.tickets")).rows[0]
          .n,
        2,
      );
      expectStatus(
        await call(`/api/orders/${order.id}/details`, {
          cookie: accounts.admin.cookie,
        }),
        404,
      );
    });
  } finally {
    /* Test cleanup is registered before setup to also handle failures. */
  }
});
