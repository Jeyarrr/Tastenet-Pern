import bcrypt from "bcryptjs";

import { HttpError } from "../lib/HttpError.js";
import { rateLimit } from "./rate-limit.js";

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
