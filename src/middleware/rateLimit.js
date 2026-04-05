import { rateLimit } from 'express-rate-limit';
import { HEALTH_CHECK_PATH, HTTP_STATUS, MS_PER_MINUTE } from '../config/constants.js';
import { env } from '../config/env.js';

function tooManyPayload(req) {
  return {
    data: null,
    errors: [
      {
        code: 'TOO_MANY_REQUESTS',
        message: 'Trop de requêtes. Réessayez plus tard.',
        request_id: req.id,
      },
    ],
  };
}

/**
 * Plafond global par IP (toutes routes sauf exclusions).
 * Derrière un reverse proxy, `trust proxy` doit être configuré (déjà le cas dans app.js).
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path === HEALTH_CHECK_PATH,
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(tooManyPayload(req));
  },
});

/**
 * Plafond court sur /api/v1 (force brute sur Bearer, énumération, etc.).
 * Désactivé si RATE_LIMIT_API_PER_MINUTE vaut 0.
 */
export const apiV1BurstLimiter =
  env.rateLimitApiPerMinute > 0
    ? rateLimit({
        windowMs: MS_PER_MINUTE,
        limit: env.rateLimitApiPerMinute,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(tooManyPayload(req));
        },
      })
    : null;
