import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { createPool } from "./db.js";

const config = readConfig();
const db = createPool(config.DATABASE_URL);
db.on("error", (error) => console.error("PostgreSQL pool error:", error));
const server = createApp({ db, config }).listen(config.PORT, () => {
  console.log(`TasteNet API listening on port ${config.PORT}`);
});

async function shutdown() {
  server.close();
  await db.end();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
