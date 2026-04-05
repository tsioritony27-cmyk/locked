import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { HTTP_STATUS, MIN_AMOUNT_AR } from '../config/constants.js';
import { completeDeposit, completeWithdrawal } from '../services/transactionsService.js';
import { wrapAsync } from '../lib/wrapAsync.js';

const router = Router({ mergeParams: true });

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

const providers = ['mvola', 'orange_money', 'airtel_money'];

/** POST /api/v1/goals/:goalId/deposits */
router.post(
  '/deposits',
  param('goalId').isUUID(),
  body('amount_ar').isInt({ min: MIN_AMOUNT_AR }),
  body('provider').isIn(providers),
  body('promo_code').optional().isString().trim(),
  handleValidation,
  wrapAsync(async (req, res) => {
    const { amount_ar, provider, promo_code } = req.body;
    const result = await completeDeposit({
      goalId: req.params.goalId,
      userId: req.user.id,
      amountAr: amount_ar,
      provider,
      promoCodeRaw: promo_code,
    });
    const depositStatus =
      result.status === 'completed' ? HTTP_STATUS.CREATED : HTTP_STATUS.ACCEPTED;
    res.status(depositStatus).json({ data: result, errors: [] });
  }),
);

/** POST /api/v1/goals/:goalId/withdrawals — montant net vers mobile money */
router.post(
  '/withdrawals',
  param('goalId').isUUID(),
  body('net_amount_ar').isInt({ min: MIN_AMOUNT_AR }),
  handleValidation,
  wrapAsync(async (req, res) => {
    const result = await completeWithdrawal({
      goalId: req.params.goalId,
      userId: req.user.id,
      netAmountAr: req.body.net_amount_ar,
    });
    const withdrawalStatus =
      result.status === 'completed' ? HTTP_STATUS.CREATED : HTTP_STATUS.ACCEPTED;
    res.status(withdrawalStatus).json({ data: result, errors: [] });
  }),
);

export default router;
