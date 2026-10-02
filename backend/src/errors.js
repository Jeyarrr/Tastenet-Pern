export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found'));
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status;
  let code = error.code;
  let message = error.message;
  if (error.code === '23505') {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with those details already exists';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON request body';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
    code = 'INTERNAL_ERROR';
    message = 'An unexpected error occurred';
  }
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
}
