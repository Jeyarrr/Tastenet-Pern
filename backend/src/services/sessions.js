import { createHash, randomBytes } from "node:crypto";

export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");

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

export async function deleteSession(db, token) {
  if (token)
    await db.query("DELETE FROM tastenet.auth_sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
}
