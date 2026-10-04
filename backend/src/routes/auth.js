import { Router } from "express";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  authenticate,
  cookieOptions,
  createSession,
  deleteSession,
} from "../auth.js";
import { HttpError } from "../errors.js";
import { validate } from "../validate.js";
import {
  addressSchema,
  formatAddress,
  passwordSchema,
  confirmPassword,
} from "../services/account-security.js";
import { ownedFile } from "./files.js";
import { vehicleSchema, documentColumns } from "./profile-features.js";
import { transaction } from "../services/transaction.js";
import { rateLimit } from "../services/rate-limit.js";

export const registerSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[\p{L}\p{N}_.-]+$/u),
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(200),
  phone: z
    .string()
    .regex(/^\+639[0-9]{9}$/, "Use a Philippine mobile number")
    .optional(),
  addressDetails: addressSchema.optional(),
  address: z.string().trim().max(1000).optional(),
});
const loginSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };
}

export function authRouter(db, config) {
  const router = Router();
  const requireAuth = authenticate(db, config);

  router.post(
    "/register",
    validate(registerSchema),
    rateLimit(db, "register", 5),
    async (req, res) => {
      if (config.EMAIL_VERIFICATION_REQUIRED)
        throw new HttpError(
          400,
          "EMAIL_VERIFICATION_REQUIRED",
          "Verify your email to complete registration",
        );
      const {
        username,
        email,
        password,
        fullName,
        phone,
        address,
        addressDetails,
      } = req.validated;
      const normalizedAddress =
        (await formatAddress(db, addressDetails)) || address;
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await db.query(
        `INSERT INTO tastenet.users (username, email, password_hash, full_name, phone, address_details, address, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'customer')
       RETURNING id, username, email, full_name, role`,
        [
          username,
          email,
          passwordHash,
          fullName,
          phone ?? null,
          addressDetails ? JSON.stringify(addressDetails) : null,
          normalizedAddress ?? null,
        ],
      );
      res.status(201).json({ user: publicUser(result.rows[0]) });
    },
  );

  router.post(
    "/login",
    validate(loginSchema),
    rateLimit(db, "login", 20),
    async (req, res) => {
      const { identifier, password } = req.validated;
      const result = await db.query(
        `SELECT id, username, email, password_hash, full_name, role, is_active
         FROM tastenet.users WHERE deleted_at IS NULL AND (lower(username) = lower($1) OR lower(email) = lower($1))
         LIMIT 1`,
        [identifier],
      );
      const user = result.rows[0];
      if (
        !user ||
        !user.password_hash ||
        !(await bcrypt.compare(password, user.password_hash))
      ) {
        throw new HttpError(
          401,
          "INVALID_CREDENTIALS",
          "Invalid username or password",
        );
      }
      if (!user.is_active)
        throw new HttpError(403, "ACCOUNT_INACTIVE", "Account inactive");
      const token = await createSession(db, user.id, config);
      res.cookie(config.SESSION_COOKIE_NAME, token, {
        ...cookieOptions(config),
        maxAge: req.validated.rememberMe
          ? cookieOptions(config).maxAge
          : undefined,
      });
      res.json({ user: publicUser(user) });
    },
  );

  router.post("/logout", async (req, res) => {
    await deleteSession(db, req.cookies?.[config.SESSION_COOKIE_NAME]);
    res.clearCookie(config.SESSION_COOKIE_NAME, {
      ...cookieOptions(config),
      maxAge: undefined,
    });
    res.status(204).end();
  });

  router.get("/me", requireAuth, (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  const profileColumns = `id, username, email, full_name, phone, address, address_details, role,
    rider_status, vehicle, vehicle_model, vehicle_year, vehicle_color, license_plate, license_number,
    nbi_number, orcr_number, insurance_policy, insurance_date, coalesce(nullif(profile_photo,''),nullif(profile_picture,'')) AS profile_photo, ratings, date_joined, created_at`;
  router.get("/profile", requireAuth, async (req, res) => {
    const result = await db.query(
      `SELECT ${profileColumns} FROM tastenet.users WHERE id = $1`,
      [req.user.id],
    );
    res.json({ profile: result.rows[0] });
  });
  router.get(
    "/username-availability",
    rateLimit(db, "username-availability", 120),
    async (req, res) => {
      const username = registerSchema.shape.username.parse(req.query.username);
      const exists = await db.query(
        "SELECT 1 FROM tastenet.users WHERE lower(username)=lower($1)",
        [username],
      );
      res.json({ available: !exists.rows.length });
    },
  );
  router.patch(
    "/profile",
    requireAuth,
    validate(
      z.strictObject({
        fullName: z.string().trim().min(1).max(200),
        email: z
          .email()
          .max(320)
          .transform((value) => value.toLowerCase()),
        phone: z
          .string()
          .regex(/^\+639[0-9]{9}$/, "Use a Philippine mobile number"),
        addressDetails: addressSchema.optional(),
        photoUrl: z.string().max(150).optional(),
        vehicleDetails: vehicleSchema.optional(),
        documents: z
          .record(z.enum(documentColumns), z.string().max(150))
          .optional(),
        currentPassword: z.string().min(1).max(128),
      }),
    ),
    confirmPassword(db),
    async (req, res) => {
      const v = req.validated;
      if ((v.vehicleDetails || v.documents) && req.user.role !== "rider")
        throw new HttpError(403, "FORBIDDEN", "Rider account required");
      const address = await formatAddress(db, v.addressDetails);
      const profile = await transaction(db, async (client) => {
        if (v.photoUrl)
          await ownedFile(client, v.photoUrl, req.user.id, "profile");
        await client.query(
          `UPDATE tastenet.users SET full_name=$1,email=$2::text,phone=$3,
        email_verified=CASE WHEN email=$2::text THEN email_verified ELSE false END,
        address=coalesce($4,address),address_details=coalesce($5::jsonb,address_details),
        profile_photo=coalesce($6,profile_photo),profile_picture=coalesce($6,profile_picture),updated_at=now() WHERE id=$7`,
          [
            v.fullName,
            v.email,
            v.phone,
            address,
            v.addressDetails ? JSON.stringify(v.addressDetails) : null,
            v.photoUrl || null,
            req.user.id,
          ],
        );
        if (v.vehicleDetails) {
          const t = v.vehicleDetails;
          await client.query(
            `UPDATE tastenet.users SET vehicle=$1,vehicle_model=$2,vehicle_year=$3,license_plate=$4,vehicle_color=$5,license_number=$6,nbi_number=$7,orcr_number=$8,insurance_policy=$9,insurance_date=$10 WHERE id=$11`,
            [
              t.vehicle,
              t.vehicleModel,
              t.vehicleYear,
              t.licensePlate,
              t.vehicleColor,
              t.licenseNumber,
              t.nbiNumber,
              t.orcrNumber,
              t.insurancePolicy,
              t.insuranceDate || null,
              req.user.id,
            ],
          );
        }
        for (const [column, url] of Object.entries(v.documents || {})) {
          await ownedFile(client, url, req.user.id, "rider-document");
          await client.query(
            `UPDATE tastenet.users SET ${column}=$1 WHERE id=$2`,
            [url, req.user.id],
          );
          await client.query(
            `INSERT INTO tastenet.rider_doc_approvals(user_id,doc_column,status) VALUES ($1,$2,'pending') ON CONFLICT(user_id,doc_column) DO UPDATE SET status='pending',reviewed_by=NULL,review_notes=NULL,updated_at=now()`,
            [req.user.id, column],
          );
        }
        return (
          await client.query(
            `SELECT ${profileColumns} FROM tastenet.users WHERE id=$1`,
            [req.user.id],
          )
        ).rows[0];
      });
      res.json({ profile });
    },
  );
  router.patch(
    "/password",
    requireAuth,
    validate(
      z.strictObject({
        currentPassword: z.string().min(1).max(128),
        newPassword: passwordSchema,
      }),
    ),
    async (req, res) => {
      const result = await db.query(
        "SELECT password_hash FROM tastenet.users WHERE id=$1",
        [req.user.id],
      );
      if (
        !result.rows[0]?.password_hash ||
        !(await bcrypt.compare(
          req.validated.currentPassword,
          result.rows[0].password_hash,
        ))
      )
        throw new HttpError(
          400,
          "INVALID_PASSWORD",
          "Current password is incorrect",
        );
      if (req.validated.newPassword === req.validated.currentPassword)
        throw new HttpError(
          400,
          "PASSWORD_REUSED",
          "Choose a different new password",
        );
      const passwordHash = await bcrypt.hash(req.validated.newPassword, 12);
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "UPDATE tastenet.users SET password_hash=$1, updated_at=now() WHERE id=$2",
          [passwordHash, req.user.id],
        );
        const currentTokenHash = createHash("sha256")
          .update(req.cookies[config.SESSION_COOKIE_NAME])
          .digest("hex");
        await client.query(
          "DELETE FROM tastenet.auth_sessions WHERE user_id=$1 AND token_hash<>$2",
          [req.user.id, currentTokenHash],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      res.json({ message: "Password changed" });
    },
  );
  router.patch(
    "/availability",
    requireAuth,
    validate(z.strictObject({ status: z.enum(["online", "offline"]) })),
    async (req, res) => {
      if (req.user.role !== "rider")
        throw new HttpError(403, "FORBIDDEN", "Rider account required");
      await db.query(
        "UPDATE tastenet.users SET rider_status=$1, updated_at=now() WHERE id=$2",
        [req.validated.status, req.user.id],
      );
      res.json({ status: req.validated.status });
    },
  );
  return router;
}
