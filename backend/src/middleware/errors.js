import { HttpError } from "../lib/HttpError.js";

export function notFound(req, _res, next) {
  next(new HttpError(404, "NOT_FOUND", "Route not found"));
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status;
  let code = error.code;
  let message = error.message;
  if (error.name === "ZodError") {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Invalid request data";
  } else if (error.code === "23503") {
    status = 409;
    code = "RECORD_IN_USE";
    message = "This record is referenced by another record";
  } else if (error.code === "23514" || error.code === "22003") {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "A value is outside the allowed range";
  } else if (error.code === "23505") {
    status = 409;
    code = "CONFLICT";
    message =
      error.constraint === "users_username_ci_key"
        ? "That username is already taken. Choose another."
        : error.constraint === "users_email_ci_key"
          ? "That email is already registered."
          : "A record with those details already exists";
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Malformed JSON request body";
  } else if (error.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large";
  }
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
    code = "INTERNAL_ERROR";
    message = "An unexpected error occurred";
  }
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
}
