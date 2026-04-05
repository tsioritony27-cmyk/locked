import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    status === 500 && env.nodeEnv === 'production'
      ? 'Erreur interne.'
      : err.message || 'Erreur interne.';

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    data: null,
    errors: [{ code, message, field: err.field, request_id: req.id }],
  });
}
