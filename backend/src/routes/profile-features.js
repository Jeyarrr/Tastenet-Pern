import { documentColumns, vehicleSchema } from "../schemas/rider.js";
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { transaction } from "../services/transaction.js";
import { confirmPassword } from "../services/account-security.js";
import { ownedFile } from "../services/media.js";

export function profileFeaturesRouter(db, config) {
  const router = Router();
  router.use(authenticate(db, config));
  router.patch(
    "/vehicle",
    authorize("rider"),
    validate(
      vehicleSchema.extend({ currentPassword: z.string().min(1).max(128) }),
    ),
    confirmPassword(db),
    async (req, res) => {
      const v = req.validated;
      await db.query(
        `UPDATE tastenet.users SET vehicle=$1,vehicle_model=$2,vehicle_year=$3,license_plate=$4,
      vehicle_color=$5,license_number=$6,nbi_number=$7,orcr_number=$8,insurance_policy=$9,insurance_date=$10,updated_at=now() WHERE id=$11`,
        [
          v.vehicle,
          v.vehicleModel,
          v.vehicleYear,
          v.licensePlate,
          v.vehicleColor,
          v.licenseNumber,
          v.nbiNumber,
          v.orcrNumber,
          v.insurancePolicy,
          v.insuranceDate || null,
          req.user.id,
        ],
      );
      res.json({ message: "Vehicle information saved" });
    },
  );
  router.get("/documents", authorize("rider"), async (req, res) => {
    const user = (
      await db.query(
        `SELECT ${documentColumns.join(",")} FROM tastenet.users WHERE id=$1`,
        [req.user.id],
      )
    ).rows[0];
    const reviews = (
      await db.query(
        "SELECT doc_column,status,review_notes,updated_at FROM tastenet.rider_doc_approvals WHERE user_id=$1",
        [req.user.id],
      )
    ).rows;
    res.json({
      items: documentColumns.map((column) => ({
        column,
        url: user[column],
        ...reviews.find((review) => review.doc_column === column),
        status:
          reviews.find((review) => review.doc_column === column)?.status ||
          (user[column] ? "pending" : "missing"),
      })),
    });
  });
  router.put(
    "/documents/:column",
    authorize("rider"),
    validate(
      z.strictObject({
        url: z.string().max(150),
        currentPassword: z.string().min(1).max(128),
      }),
    ),
    confirmPassword(db),
    async (req, res) => {
      const column = z.enum(documentColumns).parse(req.params.column);
      await transaction(db, async (client) => {
        await ownedFile(
          client,
          req.validated.url,
          req.user.id,
          "rider-document",
        );
        await client.query(
          `UPDATE tastenet.users SET ${column}=$1,updated_at=now() WHERE id=$2`,
          [req.validated.url, req.user.id],
        );
        await client.query(
          `INSERT INTO tastenet.rider_doc_approvals(user_id,doc_column,status) VALUES ($1,$2,'pending')
        ON CONFLICT(user_id,doc_column) DO UPDATE SET status='pending',reviewed_by=NULL,review_notes=NULL,updated_at=now()`,
          [req.user.id, column],
        );
      });
      res.json({ message: "Document submitted for review" });
    },
  );
  router.patch(
    "/photo",
    validate(
      z.strictObject({
        url: z.string().max(150),
        currentPassword: z.string().min(1).max(128),
      }),
    ),
    confirmPassword(db),
    async (req, res) => {
      await ownedFile(db, req.validated.url, req.user.id, "profile");
      await db.query(
        "UPDATE tastenet.users SET profile_photo=$1,profile_picture=$1,updated_at=now() WHERE id=$2",
        [req.validated.url, req.user.id],
      );
      res.json({ message: "Profile photo updated" });
    },
  );
  return router;
}
