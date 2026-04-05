import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';

const router = Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const e = errors.array()[0];
    return res.status(422).json({
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
  const pct = target > 0 ? Math.min(100, Math.round((balance / target) * 10000) / 100) : 0;
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
  async (req, res, next) => {
    try {
      const { status } = req.query;
      let q = supabaseAdmin
        .from('goals')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (status) q = q.eq('status', status);

      const { data, error } = await q;
      if (error) throw error;

      res.json({
        data: { goals: (data || []).map(progressPayload) },
        meta: { total: data?.length ?? 0 },
        errors: [],
      });
    } catch (e) {
      next(e);
    }
  },
);

/** POST /api/v1/goals */
router.post(
  '/',
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('target_amount_ar').isInt({ min: 1 }),
  body('deadline').isISO8601(),
  handleValidation,
  async (req, res, next) => {
    try {
      const { title, target_amount_ar, deadline } = req.body;
      const dl = new Date(deadline);
      if (Number.isNaN(dl.getTime()) || dl.getTime() <= Date.now()) {
        throw httpError(422, 'INVALID_DEADLINE', 'La date limite doit être dans le futur.', 'deadline');
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

      res.status(201).json({ data: { goal: progressPayload(data) }, errors: [] });
    } catch (e) {
      next(e);
    }
  },
);

/** GET /api/v1/goals/:goalId */
router.get(
  '/:goalId',
  param('goalId').isUUID(),
  handleValidation,
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('goals')
        .select('*')
        .eq('id', req.params.goalId)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw httpError(404, 'NOT_FOUND', 'Objectif introuvable.');

      res.json({ data: { goal: progressPayload(data) }, errors: [] });
    } catch (e) {
      next(e);
    }
  },
);

/** PATCH /api/v1/goals/:goalId — annulation uniquement (pas de retrait anticipé) */
router.patch(
  '/:goalId',
  param('goalId').isUUID(),
  body('status').optional().isIn(['cancelled']),
  handleValidation,
  async (req, res, next) => {
    try {
      const { status } = req.body;
      if (status !== 'cancelled') {
        throw httpError(422, 'VALIDATION', 'Seul le statut cancelled est autorisé.', 'status');
      }

      const { data: goal } = await supabaseAdmin
        .from('goals')
        .select('id, balance_ar, status')
        .eq('id', req.params.goalId)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (!goal) throw httpError(404, 'NOT_FOUND', 'Objectif introuvable.');
      if (goal.status !== 'active') {
        throw httpError(400, 'INVALID_STATE', 'Impossible d’annuler cet objectif.');
      }
      if (Number(goal.balance_ar) > 0) {
        throw httpError(
          403,
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
    } catch (e) {
      next(e);
    }
  },
);

export default router;
