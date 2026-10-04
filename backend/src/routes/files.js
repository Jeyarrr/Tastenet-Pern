import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticate } from "../auth.js";
import { HttpError } from "../errors.js";

const kinds = [
  "menu",
  "payment-qr",
  "profile",
  "rider-document",
  "payment-proof",
  "delivery-proof",
];
export async function ownedFile(client, url, userId, purpose, ticketId = null) {
  const id = /^\/api\/files\/([a-f0-9-]{36})$/.exec(url || "")?.[1];
  if (!id || !z.uuid().safeParse(id).success)
    throw new HttpError(400, "INVALID_FILE", "Upload a valid file first");
  const result = await client.query(
    `SELECT id FROM tastenet.media_files
    WHERE id=$1 AND owner_id=$2 AND purpose=$3 AND ($4::bigint IS NULL OR ticket_id=$4)`,
    [id, userId, purpose, ticketId],
  );
  if (!result.rows.length)
    throw new HttpError(403, "INVALID_FILE", "This file cannot be used here");
  return url;
}
export function filesRouter(db, config) {
  const router = Router();
  const auth = authenticate(db, config);
  router.post(
    "/",
    auth,
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      limit: "3mb",
    }),
    async (req, res) => {
      const purpose = req.query.purpose;
      if (!kinds.includes(purpose))
        throw new HttpError(
          400,
          "INVALID_FILE",
          "Choose a valid upload purpose",
        );
      if (
        (purpose === "menu" &&
          !["admin", "superadmin"].includes(req.user.role)) ||
        (purpose === "payment-qr" && req.user.role !== "superadmin") ||
        (purpose === "rider-document" && req.user.role !== "rider")
      )
        throw new HttpError(403, "FORBIDDEN", "This upload is not permitted");
      const data = req.body,
        type = req.get("content-type")?.split(";")[0];
      if (!Buffer.isBuffer(data) || !data.length)
        throw new HttpError(
          400,
          "INVALID_FILE",
          "Choose a JPG, PNG or WebP image up to 3 MB. Rider documents also accept PDF.",
        );
      const matches =
        type === "image/png"
          ? data
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : type === "image/jpeg"
            ? data[0] === 255 && data[1] === 216 && data[2] === 255
            : type === "image/webp"
              ? data.length >= 12 &&
                data.subarray(0, 4).toString() === "RIFF" &&
                data.subarray(8, 12).toString() === "WEBP"
              : type === "application/pdf" &&
                purpose === "rider-document" &&
                data.subarray(0, 5).toString() === "%PDF-";
      if (!matches)
        throw new HttpError(
          400,
          "INVALID_FILE",
          "The file contents do not match a supported format",
        );
      let ticketId = null;
      if (purpose.endsWith("-proof")) {
        ticketId = Number(req.query.ticketId);
        if (!Number.isSafeInteger(ticketId) || ticketId <= 0)
          throw new HttpError(400, "INVALID_ORDER", "Choose an order");
        const order = (
          await db.query(
            "SELECT * FROM tastenet.tickets WHERE id=$1 AND deleted_at IS NULL",
            [ticketId],
          )
        ).rows[0];
        if (
          !order ||
          (purpose === "delivery-proof"
            ? req.user.role !== "rider" ||
              String(order.rider_id) !== String(req.user.id) ||
              order.status !== "In Progress"
            : String(order.created_by) !== String(req.user.id) ||
              ["Completed", "Cancelled"].includes(order.status))
        )
          throw new HttpError(
            403,
            "FORBIDDEN",
            "This proof cannot be uploaded for that order",
          );
      }
      const id = randomUUID();
      await db.query(
        `INSERT INTO tastenet.media_files(id,owner_id,ticket_id,purpose,content_type,size,data)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, req.user.id, ticketId, purpose, type, data.length, data],
      );
      res.status(201).json({
        url: `/api/files/${id}`,
        size: data.length,
        contentType: type,
      });
    },
  );
  router.get(
    "/:id",
    async (req, res, next) => {
      if (!z.uuid().safeParse(req.params.id).success)
        throw new HttpError(404, "NOT_FOUND", "File not found");
      const file = (
        await db.query(
          "SELECT id,owner_id,ticket_id,purpose,content_type FROM tastenet.media_files WHERE id=$1",
          [req.params.id],
        )
      ).rows[0];
      if (!file) throw new HttpError(404, "NOT_FOUND", "File not found");
      req.media = file;
      if (["menu", "payment-qr"].includes(file.purpose)) return next();
      return auth(req, res, next);
    },
    async (req, res) => {
      const file = req.media,
        publicFile = ["menu", "payment-qr"].includes(file.purpose);
      if (
        !publicFile &&
        String(file.owner_id) !== String(req.user.id) &&
        req.user.role !== "superadmin"
      ) {
        let allowed = false;
        if (file.ticket_id) {
          const order = (
            await db.query(
              "SELECT created_by,rider_id FROM tastenet.tickets WHERE id=$1",
              [file.ticket_id],
            )
          ).rows[0];
          allowed =
            req.user.role === "admin" ||
            (order &&
              [order.created_by, order.rider_id].some(
                (id) => String(id) === String(req.user.id),
              ));
        }
        if (!allowed)
          throw new HttpError(403, "FORBIDDEN", "This file is private");
      }
      const result = await db.query(
        "SELECT data FROM tastenet.media_files WHERE id=$1",
        [file.id],
      );
      res.set("X-Content-Type-Options", "nosniff");
      res.set(
        "Cache-Control",
        publicFile ? "public, max-age=86400, immutable" : "private, no-store",
      );
      res.set("Content-Security-Policy", "default-src 'none'; sandbox");
      if (file.content_type === "application/pdf")
        res.set(
          "Content-Disposition",
          'attachment; filename="rider-document.pdf"',
        );
      res.type(file.content_type).send(Buffer.from(result.rows[0].data));
    },
  );
  return router;
}
