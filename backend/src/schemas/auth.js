import { z } from "zod";
import { addressSchema, passwordSchema } from "./account.js";

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

export const loginSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});
