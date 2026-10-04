import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { readConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { transaction } from "../src/services/transaction.js";

// Read only by default; --apply updates referenced paths without deleting source files.
const apply = process.argv.includes("--apply");
const source = await realpath(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.reference/TasteNet",
  ),
);
const db = createPool(readConfig().DATABASE_URL);
const counts = {
  available: 0,
  imported: 0,
  missing: 0,
  unsupported: 0,
  alreadyMigrated: 0,
};
async function asset(
  table,
  id,
  column,
  value,
  ownerId,
  purpose,
  ticketId = null,
) {
  if (!value) return;
  if (value.startsWith("/api/files/")) {
    counts.alreadyMigrated++;
    return;
  }
  if (!ownerId) {
    counts.unsupported++;
    return;
  }
  const normalized = value.replaceAll("\\", "/");
  const relative =
    normalized.match(/(?:^|\/)((?:Uploads|Images)\/.*)$/i)?.[1] ||
    normalized.replace(/^~?\/+/, "");
  if (!/^(Uploads|Images)\//i.test(relative)) {
    counts.unsupported++;
    return;
  }
  let file;
  try {
    file = await realpath(path.resolve(source, relative));
  } catch {
    counts.missing++;
    return;
  }
  if (!file.toLowerCase().startsWith((source + path.sep).toLowerCase()))
    throw new Error("Legacy file is outside the source directory");
  const bytes = await readFile(file);
  const contentType = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : purpose === "rider-document" &&
          bytes.subarray(0, 5).toString() === "%PDF-"
        ? "application/pdf"
        : null;
  if (!contentType || bytes.length > 3145728) {
    counts.unsupported++;
    return;
  }
  counts.available++;
  if (!apply) return;
  // Table/column identifiers are fixed in the calls below, never read from input.
  await transaction(db, async (client) => {
    const mediaId = randomUUID();
    await client.query(
      `INSERT INTO tastenet.media_files(id,owner_id,ticket_id,purpose,content_type,size,data,source_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        mediaId,
        ownerId,
        ticketId,
        purpose,
        contentType,
        bytes.length,
        bytes,
        value,
      ],
    );
    await client.query(
      `UPDATE tastenet.${table} SET ${column}=$1 WHERE id=$2`,
      ["/api/files/" + mediaId, id],
    );
  });
  counts.imported++;
}
try {
  const owner = (
    await db.query(
      "SELECT id FROM tastenet.users WHERE role='superadmin' AND is_active ORDER BY id LIMIT 1",
    )
  ).rows[0]?.id;
  const users = (
    await db.query(
      "SELECT id,profile_photo,profile_picture,driver_license_photo,orcr_photo,insurance_photo,nbi_clearance_photo FROM tastenet.users",
    )
  ).rows;
  for (const u of users) {
    for (const column of ["profile_photo", "profile_picture"])
      await asset("users", u.id, column, u[column], u.id, "profile");
    for (const column of [
      "driver_license_photo",
      "orcr_photo",
      "insurance_photo",
      "nbi_clearance_photo",
    ])
      await asset("users", u.id, column, u[column], u.id, "rider-document");
  }
  for (const p of (
    await db.query(
      "SELECT p.*,t.rider_id,t.created_by FROM tastenet.proofs p JOIN tastenet.tickets t ON t.id=p.ticket_id",
    )
  ).rows) {
    await asset(
      "proofs",
      p.id,
      "proof_of_delivery",
      p.proof_of_delivery,
      p.rider_id || owner,
      "delivery-proof",
      p.ticket_id,
    );
    await asset(
      "proofs",
      p.id,
      "proof_of_payment",
      p.proof_of_payment,
      p.created_by || owner,
      "payment-proof",
      p.ticket_id,
    );
  }
  for (const p of (
    await db.query("SELECT id,qr_photo FROM tastenet.payment_methods")
  ).rows)
    await asset(
      "payment_methods",
      p.id,
      "qr_photo",
      p.qr_photo,
      owner,
      "payment-qr",
    );
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", ...counts }));
} finally {
  await db.end();
}
