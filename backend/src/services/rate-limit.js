import { createHash } from "node:crypto";
import { HttpError } from "../errors.js";
export function rateLimit(db, namespace, limit = 10, seconds = 600) {
  return async (req, res, next) => {
    const identity = `${namespace}:${req.ip}:${String(req.user?.id || req.body?.identifier || req.body?.email || "").toLowerCase()}`;
    const key = createHash("sha256").update(identity).digest("hex");
    const result = await db.query(
      `INSERT INTO tastenet.request_limits(key_hash,hits,expires_at) VALUES ($1,1,now()+($2 * interval '1 second'))
      ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN request_limits.expires_at<now() THEN 1 ELSE request_limits.hits+1 END,
      expires_at=CASE WHEN request_limits.expires_at<now() THEN now()+($2 * interval '1 second') ELSE request_limits.expires_at END RETURNING hits`,
      [key, seconds],
    );
    if (result.rows[0].hits > limit) {
      res.set("Retry-After", String(seconds));
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "Too many attempts. Please try again later.",
      );
    }
    next();
  };
}
