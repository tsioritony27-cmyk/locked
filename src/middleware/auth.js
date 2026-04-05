import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Vérifie le JWT Supabase (Authorization: Bearer <access_token>).
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      data: null,
      errors: [
        { code: 'UNAUTHORIZED', message: 'Jeton d’authentification requis (Bearer).' },
      ],
    });
  }

  const token = header.slice(7);
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({
      data: null,
      errors: [
        {
          code: 'INVALID_TOKEN',
          message: 'Jeton invalide ou expiré.',
        },
      ],
    });
  }

  req.user = { id: user.id, email: user.email };
  req.accessToken = token;
  next();
}
