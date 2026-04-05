import { HTTP_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    status === HTTP_STATUS.INTERNAL_SERVER_ERROR && env.nodeEnv === 'production'
      ? 'Erreur interne.'
      : err.message || 'Erreur interne.';

  if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    console.error(err);
  }

  res.status(status).json({
    data: null,
    errors: [{ code, message, field: err.field, request_id: req.id }],
  });
}
