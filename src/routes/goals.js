import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  FULL_PERCENT,
  GOAL_TITLE_MAX_LENGTH,
  HTTP_STATUS,
  MIN_AMOUNT_AR,
  PERCENT_DIVISOR,
  PROGRESS_RATIO_SCALE,
} from '../config/constants.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';
import { wrapAsync } from '../lib/wrapAsync.js';

const router = Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const e = errors.array()[0];
    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      data: null,
      errors: [
        {
          code: 'VALIDATION_ERROR',
          message: e.msg,
          field: e.path,
        },
      ],
    });
  }
  next();
}

function progressPayload(goal) {
  const target = Number(goal.target_amount_ar);
  const balance = Number(goal.balance_ar);
  const pct =
    target > 0
      ? Math.min(
          FULL_PERCENT,
          Math.round((balance / target) * PROGRESS_RATIO_SCALE) / PERCENT_DIVISOR,
        )
      : 0;
  return {
    ...goal,
    progress_percent: pct,
    remaining_amount_ar: Math.max(0, target - balance),
  };
}

/** GET /api/v1/goals */
router.get(
  '/',
  query('status').optional().isIn(['active', 'completed', 'cancelled']),
  handleValidation,
  wrapAsync(async (req, res) => {
    const { status } = req.query;
    let q = supabaseAdmin
      .from('goals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data ?? [];
    res.json({
      data: { goals: rows.map(progressPayload) },
      meta: { total: rows.length },
      errors: [],
    });
  }),
);

/** POST /api/v1/goals */
router.post(
  '/',
  body('title').trim().isLength({ min: 1, max: GOAL_TITLE_MAX_LENGTH }),
  body('target_amount_ar').isInt({ min: MIN_AMOUNT_AR }),
  body('deadline').isISO8601(),
  handleValidation,
  wrapAsync(async (req, res) => {
    const { title, target_amount_ar, deadline } = req.body;
    const dl = new Date(deadline);
    if (Number.isNaN(dl.getTime()) || dl.getTime() <= Date.now()) {
      throw httpError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        'INVALID_DEADLINE',
        'La date limite doit être dans le futur.',
        'deadline',
      );
    }

    const { data, error } = await supabaseAdmin
      .from('goals')
      .insert({
        user_id: req.user.id,
        title,
        target_amount_ar,
        deadline: dl.toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(HTTP_STATUS.CREATED).json({ data: { goal: progressPayload(data) }, errors: [] });
  }),
);

/** GET /api/v1/goals/:goalId */
router.get(
  '/:goalId',
  param('goalId').isUUID(),
  handleValidation,
  wrapAsync(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('goals')
      .select('*')
      .eq('id', req.params.goalId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Objectif introuvable.');

    res.json({ data: { goal: progressPayload(data) }, errors: [] });
  }),
);

/** PATCH /api/v1/goals/:goalId — annulation uniquement (pas de retrait anticipé) */
router.patch(
  '/:goalId',
  param('goalId').isUUID(),
  body('status').optional().isIn(['cancelled']),
  handleValidation,
  wrapAsync(async (req, res) => {
    const { status } = req.body;
    if (status !== 'cancelled') {
      throw httpError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        'VALIDATION',
        'Seul le statut cancelled est autorisé.',
        'status',
      );
    }

    const { data: goal, error: fetchGoalErr } = await supabaseAdmin
      .from('goals')
      .select('id, balance_ar, status')
      .eq('id', req.params.goalId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchGoalErr) throw fetchGoalErr;
    if (!goal) throw httpError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Objectif introuvable.');
    if (goal.status !== 'active') {
      throw httpError(
        HTTP_STATUS.BAD_REQUEST,
        'INVALID_STATE',
        'Impossible d’annuler cet objectif.',
      );
    }
    if (Number(goal.balance_ar) > 0) {
      throw httpError(
        HTTP_STATUS.FORBIDDEN,
        'BALANCE_NOT_EMPTY',
        'Impossible d’annuler tant qu’un solde positif existe. Utilisez un retrait après la date limite.',
      );
    }

    const { data, error } = await supabaseAdmin
      .from('goals')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.goalId)
      .eq('user_id', req.user.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data: { goal: progressPayload(data) }, errors: [] });
  }),
);

export default router;
