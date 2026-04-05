import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { completeDeposit, completeWithdrawal } from '../services/transactionsService.js';

const router = Router({ mergeParams: true });

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

const providers = ['mvola', 'orange_money', 'airtel_money'];

/** POST /api/v1/goals/:goalId/deposits */
router.post(
  '/deposits',
  param('goalId').isUUID(),
  body('amount_ar').isInt({ min: 1 }),
  body('provider').isIn(providers),
  body('promo_code').optional().isString().trim(),
  handleValidation,
  async (req, res, next) => {
    try {
      const { amount_ar, provider, promo_code } = req.body;
      const result = await completeDeposit({
        goalId: req.params.goalId,
        userId: req.user.id,
        amountAr: amount_ar,
        provider,
        promoCodeRaw: promo_code,
      });
      res.status(result.status === 'completed' ? 201 : 202).json({ data: result, errors: [] });
    } catch (e) {
      next(e);
    }
  },
);

/** POST /api/v1/goals/:goalId/withdrawals — montant net vers mobile money */
router.post(
  '/withdrawals',
  param('goalId').isUUID(),
  body('net_amount_ar').isInt({ min: 1 }),
  handleValidation,
  async (req, res, next) => {
    try {
      const result = await completeWithdrawal({
        goalId: req.params.goalId,
        userId: req.user.id,
        netAmountAr: req.body.net_amount_ar,
      });
      res.status(result.status === 'completed' ? 201 : 202).json({ data: result, errors: [] });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
