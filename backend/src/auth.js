import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./errors.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(db, userId, config) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO tastenet.auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 day'))",
    [userId, hashToken(token), config.SESSION_DAYS],
  );
  return token;
}

export function authenticate(db, config) {
  return async (req, _res, next) => {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (!token)
      return next(new HttpError(401, "UNAUTHENTICATED", "Sign in required"));
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active
         FROM tastenet.auth_sessions s JOIN tastenet.users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.deleted_at IS NULL`,
      [hashToken(token)],
    );
    const user = result.rows[0];
    if (!user || !user.is_active)
      return next(
        new HttpError(
          401,
          "UNAUTHENTICATED",
          "Session expired or account inactive",
        ),
      );
    req.user = user;
    next();
  };
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user)
      return next(new HttpError(401, "UNAUTHENTICATED", "Sign in required"));
    if (!roles.includes(req.user.role))
      return next(new HttpError(403, "FORBIDDEN", "Insufficient permissions"));
    next();
  };
}

export async function deleteSession(db, token) {
  if (token)
    await db.query("DELETE FROM tastenet.auth_sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
}
