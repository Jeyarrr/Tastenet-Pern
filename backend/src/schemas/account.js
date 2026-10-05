import { z } from "zod";

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
