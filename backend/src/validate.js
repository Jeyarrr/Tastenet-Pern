import { HttpError } from './errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body');
      error.details = result.error.flatten();
      return next(error);
    }
    req.validated = result.data;
    next();
  };
}
