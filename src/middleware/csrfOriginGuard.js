import { HTTP_STATUS } from '../config/constants.js';
import { env } from '../config/env.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Mitigation CSRF côté navigateur : si l’en-tête Origin est présent (typique des
 * requêtes cross-origin depuis un front), il doit correspondre à une entrée de
 * CORS_ORIGINS. Les clients sans Origin (curl, apps natives) passent.
 *
 * L’authentification par jeton Bearer dans Authorization évite déjà le scénario
 * classique du CSRF (un formulaire HTML tiers ne peut pas fixer cet en-tête).
 */
export function csrfOriginGuard(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  if (env.nodeEnv === 'development') return next();

  if (env.corsOrigins.length === 0) return next();

  const raw = req.get('Origin');
  if (!raw) return next();

  const origin = toOrigin(raw);
  if (!origin) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      data: null,
      errors: [{ code: 'FORBIDDEN_ORIGIN', message: 'Origin invalide.' }],
    });
  }

  const allowed = env.corsOrigins.some((entry) => {
    const o = toOrigin(entry);
    return o ? origin === o : origin === entry;
  });

  if (!allowed) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      data: null,
      errors: [{ code: 'FORBIDDEN_ORIGIN', message: 'Origine de la requête non autorisée.' }],
    });
  }

  next();
}
