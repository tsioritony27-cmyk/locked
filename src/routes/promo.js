import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import {
  HTTP_STATUS,
  POSTGRES_UNIQUE_VIOLATION,
  PROMO_CODE_MAX_LENGTH,
  PROMO_CODE_MIN_LENGTH,
} from '../config/constants.js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import { wrapAsync } from '../lib/wrapAsync.js';

const router = Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const e = errors.array()[0];
    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
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
  body('code')
    .trim()
    .isLength({ min: PROMO_CODE_MIN_LENGTH, max: PROMO_CODE_MAX_LENGTH })
    .matches(/^[A-Z0-9_-]+$/i),
  body('max_uses').optional().isInt({ min: 1 }),
  handleValidation,
  wrapAsync(async (req, res) => {
    const raw = String(req.body.code).trim().toUpperCase();
    const maxUses = req.body.max_uses != null ? req.body.max_uses : null;

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        code: raw,
        influencer_user_id: req.user.id,
        percent_first_deposit: env.promoFirstDepositPercent,
        active: true,
        max_uses: maxUses,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === POSTGRES_UNIQUE_VIOLATION) {
        throw httpError(HTTP_STATUS.CONFLICT, 'DUPLICATE', 'Ce code existe déjà.');
      }
      throw error;
    }

    res.status(HTTP_STATUS.CREATED).json({ data: { promo_code: data }, errors: [] });
  }),
);

/** GET /api/v1/promo-codes/:code — validation légère (actif / existe) */
router.get(
  '/:code',
  wrapAsync(async (req, res) => {
    const code = String(req.params.code).trim().toUpperCase();
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('id, code, active, percent_first_deposit, max_uses, uses_count')
      .eq('code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Code introuvable.');

    const exhausted = data.max_uses != null && data.uses_count >= data.max_uses;
    res.json({
      data: {
        valid: data.active && !exhausted,
        percent_first_deposit: data.percent_first_deposit,
      },
      errors: [],
    });
  }),
);

export default router;
