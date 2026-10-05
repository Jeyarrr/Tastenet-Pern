import { Router } from "express";
import {
  randomBytes,
  randomInt,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../lib/HttpError.js";
import { transaction } from "../services/transaction.js";
import { rateLimit } from "../services/rate-limit.js";
import { emailAvailable, emailSender } from "../services/email.js";
import { formatAddress } from "../services/account-security.js";
import { registerSchema } from "../schemas/auth.js";
import { publicUser } from "../services/public-user.js";
import { cookieOptions, createSession } from "../services/sessions.js";

const emailInput = z.strictObject({
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
});
const codeInput = emailInput.extend({ code: z.string().regex(/^\d{6}$/) });
const resetInput = codeInput.extend({
  password: registerSchema.shape.password,
});
const sha = (value) => createHash("sha256").update(value).digest("hex");

export function authWorkflowsRouter(db, config, dependencies = {}) {
  const router = Router(),
    sendEmail = dependencies.sendEmail || emailSender(config);
  const google =
    dependencies.google ||
    new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI,
    );
  const googleEnabled = Boolean(
    config.GOOGLE_CLIENT_ID &&
    config.GOOGLE_CLIENT_SECRET &&
    config.GOOGLE_REDIRECT_URI,
  );
  const emailEnabled =
    emailAvailable(config) || Boolean(dependencies.sendEmail);
  router.get("/capabilities", (_req, res) =>
    res.json({
      google: googleEnabled,
      email: emailEnabled,
      registrationOtp: config.EMAIL_VERIFICATION_REQUIRED === true,
    }),
  );
  async function issue(email, purpose, payload = null) {
    const code = String(randomInt(100000, 1000000)),
      hash = await bcrypt.hash(code, 10);
    const record = await transaction(db, async (client) => {
      await client.query(
        "DELETE FROM tastenet.email_otps WHERE lower(email)=$1 AND purpose=$2",
        [email, purpose],
      );
      return (
        await client.query(
          `INSERT INTO tastenet.email_otps(email,otp_hash,purpose,payload,expires_at) VALUES ($1,$2,$3,$4,now()+interval '10 minutes') RETURNING id`,
          [email, hash, purpose, payload],
        )
      ).rows[0];
    });
    try {
      await sendEmail({ email, code, purpose });
    } catch {
      await db.query("DELETE FROM tastenet.email_otps WHERE id=$1", [
        record.id,
      ]);
      throw new HttpError(
        503,
        "EMAIL_UNAVAILABLE",
        "Email could not be delivered. Please try again later.",
      );
    }
  }
  async function consume(email, code, purpose, action) {
    const accepted = await transaction(db, async (client) => {
      const record = (
        await client.query(
          `SELECT * FROM tastenet.email_otps WHERE lower(email)=$1 AND purpose=$2 AND NOT is_verified
        AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [email, purpose],
        )
      ).rows[0];
      if (!record || record.attempts >= 5) return false;
      if (!(await bcrypt.compare(code, record.otp_hash))) {
        await client.query(
          "UPDATE tastenet.email_otps SET attempts=attempts+1 WHERE id=$1",
          [record.id],
        );
        return false;
      }
      await action(client, record.payload);
      await client.query(
        "UPDATE tastenet.email_otps SET is_verified=true,payload=NULL WHERE id=$1",
        [record.id],
      );
      return true;
    });
    if (!accepted)
      throw new HttpError(
        400,
        "INVALID_CODE",
        "The code is invalid, expired, or has too many attempts. Request a new code.",
      );
  }
  router.post(
    "/register/request-otp",
    validate(registerSchema),
    rateLimit(db, "register-email", 3),
    async (req, res) => {
      if (!emailEnabled)
        throw new HttpError(
          503,
          "EMAIL_UNAVAILABLE",
          "Email verification is not available yet",
        );
      const v = req.validated;
      const existing = await db.query(
        "SELECT 1 FROM tastenet.users WHERE lower(email)=$1 OR lower(username)=lower($2)",
        [v.email, v.username],
      );
      if (existing.rows.length)
        throw new HttpError(
          409,
          "CONFLICT",
          "That username or email is already registered",
        );
      const { password, ...profile } = v;
      profile.address =
        (await formatAddress(db, v.addressDetails)) || v.address;
      await issue(v.email, "register", {
        ...profile,
        passwordHash: await bcrypt.hash(password, 12),
      });
      res.json({ message: "Verification code sent. Check your email." });
    },
  );
  router.post(
    "/register/verify",
    validate(codeInput),
    rateLimit(db, "register-code", 10),
    async (req, res) => {
      await consume(
        req.validated.email,
        req.validated.code,
        "register",
        async (client, v) => {
          await client.query(
            `INSERT INTO tastenet.users(username,email,password_hash,full_name,phone,address_details,address,role,email_verified)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'customer',true)`,
            [
              v.username,
              v.email,
              v.passwordHash,
              v.fullName,
              v.phone || null,
              v.addressDetails ? JSON.stringify(v.addressDetails) : null,
              v.address || null,
            ],
          );
        },
      );
      res.status(201).json({ message: "Email verified. You can now sign in." });
    },
  );
  router.post(
    "/password/request-otp",
    validate(emailInput),
    rateLimit(db, "reset-email", 3),
    async (req, res) => {
      if (!emailEnabled)
        throw new HttpError(
          503,
          "EMAIL_UNAVAILABLE",
          "Password reset email is not available yet",
        );
      const found = await db.query(
        "SELECT id FROM tastenet.users WHERE lower(email)=$1 AND is_active AND deleted_at IS NULL",
        [req.validated.email],
      );
      if (found.rows.length) await issue(req.validated.email, "reset");
      res.json({
        message:
          "If an active account exists, a verification code has been sent.",
      });
    },
  );
  router.post(
    "/password/reset",
    validate(resetInput),
    rateLimit(db, "reset-code", 10),
    async (req, res) => {
      const hash = await bcrypt.hash(req.validated.password, 12);
      await consume(
        req.validated.email,
        req.validated.code,
        "reset",
        async (client) => {
          const result = await client.query(
            `UPDATE tastenet.users SET password_hash=$1,email_verified=true,updated_at=now()
        WHERE lower(email)=$2 AND is_active AND deleted_at IS NULL RETURNING id`,
            [hash, req.validated.email],
          );
          if (!result.rows.length)
            throw new HttpError(
              400,
              "INVALID_CODE",
              "Unable to reset this account",
            );
          await client.query(
            "DELETE FROM tastenet.auth_sessions WHERE user_id=$1",
            [result.rows[0].id],
          );
        },
      );
      res.json({ message: "Password reset. Sign in with your new password." });
    },
  );
  router.get("/google", async (req, res) => {
    if (!googleEnabled)
      throw new HttpError(
        503,
        "GOOGLE_UNAVAILABLE",
        "Google sign-in is not configured yet",
      );
    const state = randomBytes(32).toString("base64url"),
      nonce = randomBytes(32).toString("base64url");
    const { codeVerifier, codeChallenge } =
      await google.generateCodeVerifierAsync();
    await db.query(
      `INSERT INTO tastenet.auth_challenges(token_hash,purpose,payload,expires_at) VALUES ($1,'google',$2,now()+interval '10 minutes')`,
      [sha(state), { codeVerifier, nonce }],
    );
    res.cookie("tastenet_oauth", state, {
      ...cookieOptions(config),
      maxAge: 600000,
    });
    res.redirect(
      google.generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }),
    );
  });
  router.get("/google/callback", async (req, res) => {
    const destination = config.CLIENT_ORIGIN || "http://localhost:5173";
    try {
      if (!googleEnabled) throw new Error("Disabled");
      const state = typeof req.query.state === "string" ? req.query.state : "",
        cookie = req.cookies?.tastenet_oauth || "";
      if (
        !state ||
        state.length !== cookie.length ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
      )
        throw new Error("Invalid state");
      const challenge = (
        await db.query(
          `DELETE FROM tastenet.auth_challenges WHERE token_hash=$1 AND purpose='google' AND expires_at>now() RETURNING payload`,
          [sha(state)],
        )
      ).rows[0];
      if (!challenge || typeof req.query.code !== "string")
        throw new Error("Invalid challenge");
      const { tokens } = await google.getToken({
        code: req.query.code,
        codeVerifier: challenge.payload.codeVerifier,
      });
      const ticket = await google.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.email_verified ||
        !payload.sub ||
        payload.nonce !== challenge.payload.nonce
      )
        throw new Error("Invalid identity");
      const user = await transaction(db, async (client) => {
        let existing = (
          await client.query(
            "SELECT * FROM tastenet.users WHERE google_subject=$1 OR lower(email)=$2 FOR UPDATE",
            [payload.sub, payload.email.toLowerCase()],
          )
        ).rows[0];
        if (existing) {
          if (
            !existing.is_active ||
            existing.deleted_at ||
            (existing.google_subject && existing.google_subject !== payload.sub)
          )
            throw new Error("Account unavailable");
          await client.query(
            "UPDATE tastenet.users SET google_subject=$1,email_verified=true WHERE id=$2",
            [payload.sub, existing.id],
          );
        } else
          existing = (
            await client.query(
              `INSERT INTO tastenet.users(username,email,google_subject,full_name,role,email_verified)
          VALUES ($1,$2,$3,$4,'customer',true) RETURNING *`,
              [
                "google_" + randomBytes(10).toString("hex"),
                payload.email.toLowerCase(),
                payload.sub,
                payload.name || "Customer",
              ],
            )
          ).rows[0];
        return existing;
      });
      res.cookie(
        config.SESSION_COOKIE_NAME,
        await createSession(db, user.id, config),
        cookieOptions(config),
      );
      res.clearCookie("tastenet_oauth", {
        ...cookieOptions(config),
        maxAge: undefined,
      });
      res.redirect(`${destination}/${publicUser(user).role}`);
    } catch {
      res.clearCookie("tastenet_oauth", {
        ...cookieOptions(config),
        maxAge: undefined,
      });
      res.redirect(`${destination}/login?error=google`);
    }
  });
  return router;
}
