import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';
import { hasSixConsecutiveActiveMonths } from '../services/loanEligibility.js';

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

/** GET /api/v1/loans/eligibility */
router.get('/eligibility', async (req, res, next) => {
  try {
    const eligible = await hasSixConsecutiveActiveMonths(req.user.id);
    res.json({
      data: {
        eligible,
        rule: 'Six mois civils consécutifs avec au moins une activité par mois.',
      },
      errors: [],
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/v1/loans */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('loans')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data: { loans: data ?? [] }, meta: { total: data?.length ?? 0 }, errors: [] });
  } catch (e) {
    next(e);
  }
});

/** POST /api/v1/loans — demande (logique métier prêt à compléter : scoring, plafond) */
router.post(
  '/',
  body('amount_ar').isInt({ min: 1 }),
  body('due_date').optional().isISO8601(),
  handleValidation,
  async (req, res, next) => {
    try {
      const eligible = await hasSixConsecutiveActiveMonths(req.user.id);
      if (!eligible) {
        throw httpError(
          403,
          'LOAN_NOT_ELIGIBLE',
          'Prêt réservé aux utilisateurs avec 6 mois consécutifs d’activité.',
        );
      }

      const { amount_ar, due_date } = req.body;
      const due = due_date ? new Date(due_date) : null;

      const { data, error } = await supabaseAdmin
        .from('loans')
        .insert({
          user_id: req.user.id,
          amount_ar: amount_ar,
          status: 'pending',
          due_date: due?.toISOString() ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      res.status(201).json({ data: { loan: data }, errors: [] });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
