import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../src/migrations.js";
import { copyTasteNetData } from "../src/services/database-transfer.js";
import {
  applicationConnectionUrl,
  provisionApplicationRole,
} from "../src/services/application-role.js";

async function installation() {
  const db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../../database/schema.sql", import.meta.url),
      "utf8",
    ),
  );
  db.connect = async () => ({
    query: (sql, params) =>
      !params && sql.includes(";") ? db.exec(sql) : db.query(sql, params),
    release() {},
  });
  await migrate(db);
  return db;
}

test("database transfer preserves records and media, refuses overwrite, and rolls back failure", async (t) => {
  const source = await installation();
  const target = await installation();
  const rollbackTarget = await installation();
  try {
    const userId = "9007199254740993";
    await source.query(
      `INSERT INTO tastenet.users(id,username,email,password_hash,full_name,address_details,created_at)
      VALUES ($1,'synthetic_customer','synthetic@example.test','synthetic-hash','Sample ñ Customer',$2,'2026-10-01 00:00:00.123456+00')`,
      [
        userId,
        JSON.stringify({
          houseNumber: "12",
          street: "Sample Street",
          barangay: "Sample Area",
        }),
      ],
    );
    await source.query(
      `INSERT INTO tastenet.inventory_categories(id,category_name) VALUES (41,'Sample category')`,
    );
    await source.query(`INSERT INTO tastenet.inventory(id,item_code,item_name,category_id,current_stock,unit_cost,unit_of_measure)
      VALUES (81,'SAMPLE','Sample ingredient',41,12.345,100.12,'pcs')`);
    await source.query(
      `INSERT INTO tastenet.media_files(id,owner_id,purpose,content_type,size,data)
      VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$1,'profile','image/png',5,$2)`,
      [userId, new Uint8Array([0, 137, 80, 255, 1])],
    );
    await source.query(
      `INSERT INTO tastenet.auth_sessions(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 day')`,
      [userId, "a".repeat(64)],
    );
    await source.query(
      `INSERT INTO tastenet.email_otps(email,otp_hash,expires_at) VALUES ('synthetic@example.test','synthetic-otp',now()+interval '10 minutes')`,
    );
    await source.query(
      "SELECT setval('tastenet.users_id_seq',9007199254741000,true)",
    );

    await t.test(
      "preserves precision, foreign keys, photos, and future identity values",
      async () => {
        const summary = await copyTasteNetData(source, target);
        assert.equal(summary.find((item) => item.table === "users").rows, 1);
        const fields =
          "id::text,full_name,created_at::text,address_details::text";
        assert.deepEqual(
          (await target.query(`SELECT ${fields} FROM tastenet.users`)).rows,
          (await source.query(`SELECT ${fields} FROM tastenet.users`)).rows,
        );
        assert.deepEqual(
          (
            await target.query(
              "SELECT encode(data,'hex') AS image FROM tastenet.media_files",
            )
          ).rows,
          (
            await source.query(
              "SELECT encode(data,'hex') AS image FROM tastenet.media_files",
            )
          ).rows,
        );
        assert.equal(
          (
            await target.query(
              "SELECT current_stock::text AS stock FROM tastenet.inventory",
            )
          ).rows[0].stock,
          "12.345",
        );
        assert.equal(
          (
            await target.query(
              "SELECT count(*)::int AS n FROM tastenet.auth_sessions",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await target.query(
              "SELECT count(*)::int AS n FROM tastenet.email_otps",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await source.query(
              "SELECT count(*)::int AS n FROM tastenet.auth_sessions",
            )
          ).rows[0].n,
          1,
        );
        const inserted =
          await target.query(`INSERT INTO tastenet.users(username,email,password_hash,full_name)
        VALUES ('next_synthetic','next@example.test','synthetic-hash','Next Sample') RETURNING id::text`);
        assert.equal(inserted.rows[0].id, "9007199254741001");
      },
    );
    await t.test(
      "rejects an occupied destination without replacing records",
      async () => {
        await assert.rejects(
          copyTasteNetData(source, target),
          /already contains records/,
        );
        assert.equal(
          (await target.query("SELECT count(*)::int AS n FROM tastenet.users"))
            .rows[0].n,
          2,
        );
      },
    );
    await t.test(
      "failed insertion rolls back all copied business records",
      async () => {
        let failureInjected = false;
        const failingTarget = {
          query: (sql, params) => {
            if (sql.startsWith('INSERT INTO tastenet."media_files"')) {
              failureInjected = true;
              throw new Error("Synthetic insertion failure");
            }
            return rollbackTarget.query(sql, params);
          },
        };
        await assert.rejects(
          copyTasteNetData(source, failingTarget),
          /Synthetic insertion failure/,
        );
        assert.equal(failureInjected, true);
        for (const table of [
          "users",
          "inventory",
          "inventory_categories",
          "media_files",
        ]) {
          assert.equal(
            (
              await rollbackTarget.query(
                `SELECT count(*)::int AS n FROM tastenet.${table}`,
              )
            ).rows[0].n,
            0,
          );
        }
      },
    );
    await t.test(
      "rejects mismatched migration checksums before copying",
      async () => {
        await rollbackTarget.query(
          "UPDATE tastenet.schema_migrations SET checksum=$1",
          ["b".repeat(64)],
        );
        await assert.rejects(
          copyTasteNetData(source, rollbackTarget),
          /migration checksums do not match/,
        );
        assert.equal(
          (
            await rollbackTarget.query(
              "SELECT count(*)::int AS n FROM tastenet.users",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test(
      "application credentials permit business data and deny schema changes",
      async () => {
        await provisionApplicationRole(target, "a".repeat(64));
        await target.query("SET ROLE tastenet_app");
        try {
          assert.equal(
            (
              await target.query(
                "SELECT count(*)::int AS n FROM tastenet.users",
              )
            ).rows[0].n,
            2,
          );
          await assert.rejects(
            target.query("SELECT * FROM tastenet.schema_migrations"),
            /permission denied/,
          );
          await assert.rejects(
            target.query("CREATE TABLE tastenet.forbidden_table(id int)"),
            /permission denied/,
          );
          await assert.rejects(
            target.query(
              "ALTER TABLE tastenet.users ADD COLUMN forbidden_column text",
            ),
            /must be owner/,
          );
        } finally {
          await target.query("RESET ROLE");
        }
        const url = new URL(
          applicationConnectionUrl(
            "postgresql://postgres.syntheticref:owner-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
            "a".repeat(64),
          ),
        );
        assert.equal(url.username, "tastenet_app.syntheticref");
        assert.equal(url.searchParams.get("sslmode"), "verify-full");
      },
    );
  } finally {
    await Promise.all([source.close(), target.close(), rollbackTarget.close()]);
  }
});
