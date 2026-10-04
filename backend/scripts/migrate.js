import { createPool } from "../src/db.js";
import { readConfig } from "../src/config.js";
import { migrate } from "../src/migrations.js";

const db = createPool(readConfig().DATABASE_URL);
try {
  await migrate(db);
  console.log("Database migrations applied successfully.");
} finally {
  await db.end();
}
