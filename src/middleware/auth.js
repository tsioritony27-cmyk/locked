import { BEARER_PREFIX, HTTP_STATUS } from '../config/constants.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { wrapAsync } from '../lib/wrapAsync.js';

/**
 * Vérifie le JWT Supabase (Authorization: Bearer <access_token>).
 */
export const requireAuth = wrapAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      data: null,
      errors: [{ code: 'UNAUTHORIZED', message: 'Jeton d’authentification requis (Bearer).' }],
    });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length);
  const result = await supabaseAdmin.auth.getUser(token);
  const user = result.data?.user;
  const error = result.error;

  if (error || !user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      data: null,
      errors: [
        {
          code: 'INVALID_TOKEN',
          message: 'Jeton invalide ou expiré.',
        },
      ],
    });
    return;
  }

  req.user = { id: user.id, email: user.email };
  req.accessToken = token;
  next();
});
