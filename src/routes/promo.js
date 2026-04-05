import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const e = errors.array()[0];
    return res.status(422).json({
      data: null,
      errors: [{ code: 'VALIDATION_ERROR', message: e.msg, field: e.path }],
    });
  }
  next();
}

/** POST /api/v1/promo-codes — création par un influenceur (connecté) */
router.post(
  '/',
  requireAuth,
  body('code').trim().isLength({ min: 4, max: 32 }).matches(/^[A-Z0-9_-]+$/i),
  body('max_uses').optional().isInt({ min: 1 }),
  handleValidation,
  async (req, res, next) => {
    try {
      const raw = String(req.body.code).trim().toUpperCase();
      const maxUses = req.body.max_uses ?? null;

      const { data, error } = await supabaseAdmin
        .from('promo_codes')
        .insert({
          code: raw,
          influencer_user_id: req.user.id,
          percent_first_deposit: 20,
          active: true,
          max_uses: maxUses,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw httpError(409, 'DUPLICATE', 'Ce code existe déjà.');
        }
        throw error;
      }

      res.status(201).json({ data: { promo_code: data }, errors: [] });
    } catch (e) {
      next(e);
    }
  },
);

/** GET /api/v1/promo-codes/:code — validation légère (actif / existe) */
router.get('/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('id, code, active, percent_first_deposit, max_uses, uses_count')
      .eq('code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(404, 'NOT_FOUND', 'Code introuvable.');

    const exhausted = data.max_uses != null && data.uses_count >= data.max_uses;
    res.json({
      data: {
        valid: data.active && !exhausted,
        percent_first_deposit: data.percent_first_deposit,
      },
      errors: [],
    });
  } catch (e) {
    next(e);
  }
});

export default router;
