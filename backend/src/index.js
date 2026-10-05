import { attachDatabasePool } from "@vercel/functions";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { createPool } from "./db.js";

const config = readConfig({
  ...process.env,
  // Each preview accepts only its own platform-supplied deployment origin.
  ...(process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? { CLIENT_ORIGIN: `https://${process.env.VERCEL_URL}` }
    : {}),
});
const db = createPool(config.DATABASE_URL, {
  max: 5,
  idleTimeoutMillis: 5000,
});
attachDatabasePool(db);
db.on("error", () => console.error("PostgreSQL pool connection failed"));

// Reuse the app and pool within a function instance. Local server.js keeps its
// port listener; this entry exports the HTTP handler for Vercel.
export default createApp({ db, config });
