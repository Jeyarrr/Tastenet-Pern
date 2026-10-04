import { createPool } from "../src/db.js";
import { readConfig } from "../src/config.js";
import { transaction } from "../src/services/transaction.js";

// Operational maintenance: removes expired authentication data only.
const db = createPool(readConfig().DATABASE_URL);
try {
  const count = await transaction(db, async (client) => {
    let removed = 0;
    for (const table of [
      "auth_sessions",
      "auth_challenges",
      "email_otps",
      "request_limits",
    ]) {
      removed += (
        await client.query(
          `DELETE FROM tastenet.${table} WHERE expires_at<now()`,
        )
      ).rowCount;
    }
    return removed;
  });
  console.log(`Removed ${count} expired authentication records.`);
} finally {
  await db.end();
}
