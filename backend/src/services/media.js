import { z } from "zod";
import { HttpError } from "../lib/HttpError.js";

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
