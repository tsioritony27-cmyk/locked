import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import {
  HTTP_STATUS,
  LOAN_ELIGIBILITY_CONSECUTIVE_MONTHS,
  MIN_AMOUNT_AR,
} from '../config/constants.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';
import { wrapAsync } from '../lib/wrapAsync.js';
import { hasSixConsecutiveActiveMonths } from '../services/loanEligibility.js';

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

/** GET /api/v1/loans/eligibility */
router.get(
  '/eligibility',
  wrapAsync(async (req, res) => {
    const eligible = await hasSixConsecutiveActiveMonths(req.user.id);
    res.json({
      data: {
        eligible,
        rule: `${LOAN_ELIGIBILITY_CONSECUTIVE_MONTHS} mois civils consécutifs avec au moins une activité par mois.`,
      },
      errors: [],
    });
  }),
);

/** GET /api/v1/loans */
router.get(
  '/',
  wrapAsync(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('loans')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const loans = data ?? [];
    res.json({
      data: { loans },
      meta: { total: loans.length },
      errors: [],
    });
  }),
);

/** POST /api/v1/loans — demande (logique métier prêt à compléter : scoring, plafond) */
router.post(
  '/',
  body('amount_ar').isInt({ min: MIN_AMOUNT_AR }),
  body('due_date').optional().isISO8601(),
  handleValidation,
  wrapAsync(async (req, res) => {
    const eligible = await hasSixConsecutiveActiveMonths(req.user.id);
    if (!eligible) {
      throw httpError(
        HTTP_STATUS.FORBIDDEN,
        'LOAN_NOT_ELIGIBLE',
        `Prêt réservé aux utilisateurs avec ${LOAN_ELIGIBILITY_CONSECUTIVE_MONTHS} mois consécutifs d’activité.`,
      );
    }

    const { amount_ar, due_date } = req.body;
    const due = due_date ? new Date(due_date) : null;
    const dueDateIso = due && !Number.isNaN(due.getTime()) ? due.toISOString() : null;

    const { data, error } = await supabaseAdmin
      .from('loans')
      .insert({
        user_id: req.user.id,
        amount_ar: amount_ar,
        status: 'pending',
        due_date: dueDateIso,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(HTTP_STATUS.CREATED).json({ data: { loan: data }, errors: [] });
  }),
);

export default router;
