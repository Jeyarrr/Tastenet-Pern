import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { rateLimit } from "./rate-limit.js";

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Use at most 72 bytes",
  )
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^a-zA-Z0-9]/, "Include a symbol");
export const addressSchema = z.strictObject({
  houseNumber: z.string().trim().min(1).max(120),
  street: z.string().trim().min(1).max(200),
  barangay: z.string().trim().min(1).max(120),
});
export async function formatAddress(db, address) {
  if (!address) return null;
  const found = await db.query(
    "SELECT 1 FROM tastenet.delivery_fees WHERE barangay_name=$1",
    [address.barangay],
  );
  if (!found.rows.length)
    throw new HttpError(
      400,
      "INVALID_BARANGAY",
      "Choose a barangay from our Dasmariñas service area",
    );
  return `${address.houseNumber}, ${address.street}, ${address.barangay}, Dasmariñas, Cavite`;
}
export function confirmPassword(db) {
  return [
    rateLimit(db, "confirm-password", 10),
    async (req, _res, next) => {
      const password = req.validated?.currentPassword;
      const account = (
        await db.query(
          "SELECT password_hash FROM tastenet.users WHERE id=$1 AND is_active AND deleted_at IS NULL",
          [req.user.id],
        )
      ).rows[0];
      if (!account?.password_hash)
        throw new HttpError(
          400,
          "PASSWORD_REQUIRED",
          "Set an account password through Forgot Password before changing these details",
        );
      if (!password || !(await bcrypt.compare(password, account.password_hash)))
        throw new HttpError(
          403,
          "INVALID_PASSWORD",
          "Your current password is incorrect",
        );
      next();
    },
  ];
}
