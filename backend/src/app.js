import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { ordersRouter } from "./routes/orders.js";
import { managementRouter } from "./routes/management.js";
import { filesRouter } from "./routes/files.js";
import { profileFeaturesRouter } from "./routes/profile-features.js";
import { managementFeaturesRouter } from "./routes/management-features.js";
import { authWorkflowsRouter } from "./routes/auth-workflows.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { HttpError } from "./lib/HttpError.js";

export function createApp({ db, config, authDependencies }) {
  const app = express();
  const allowedOrigins = new Set(
    config.CLIENT_ORIGIN ? [config.CLIENT_ORIGIN] : [],
  );
  // Vite uses 5174 when another local instance already occupies 5173.
  // These loopback origins are permitted only in development.
  if (config.NODE_ENV === "development") {
    for (const host of ["localhost", "127.0.0.1"]) {
      for (const port of [5173, 5174])
        allowedOrigins.add(`http://${host}:${port}`);
    }
  }
  const isAllowedOrigin = (origin) => allowedOrigins.has(origin);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  // Cookie authenticated writes require a matching browser origin.
  app.use((req, _res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.headers.origin)
      return next();
    if (isAllowedOrigin(req.headers.origin)) return next();
    next(new HttpError(403, "ORIGIN_DENIED", "Request origin is not allowed"));
  });

  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api/auth", authRouter(db, config));
  app.use("/api/auth", authWorkflowsRouter(db, config, authDependencies));
  app.use("/api/auth", profileFeaturesRouter(db, config));
  app.use("/api/files", filesRouter(db, config));
  app.use("/api", catalogRouter(db, config));
  app.use("/api/orders", ordersRouter(db, config));
  app.use("/api/manage", managementRouter(db, config));
  app.use("/api/manage", managementFeaturesRouter(db, config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
