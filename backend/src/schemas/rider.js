import { z } from "zod";

export const documentColumns = [
  "driver_license_photo",
  "orcr_photo",
  "insurance_photo",
  "nbi_clearance_photo",
];

export const vehicleSchema = z.strictObject({
  vehicle: z.string().trim().max(100),
  vehicleModel: z.string().trim().max(100),
  vehicleYear: z.string().trim().max(20),
  licensePlate: z.string().trim().max(40),
  vehicleColor: z.string().trim().max(40),
  licenseNumber: z.string().trim().max(100),
  nbiNumber: z.string().trim().max(100),
  orcrNumber: z.string().trim().max(100),
  insurancePolicy: z.string().trim().max(150),
  insuranceDate: z.union([z.iso.date(), z.literal("")]),
});
