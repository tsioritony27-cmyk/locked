/**
 * Tests associés à src/routes/transactions.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import transactionRoutes from '../../src/routes/transactions.js';
import { HTTP_STATUS } from '../../src/config/constants.js';

vi.mock('../../src/services/transactionsService.js', () => ({
  completeDeposit: vi.fn(),
  completeWithdrawal: vi.fn(),
}));

import { completeDeposit, completeWithdrawal } from '../../src/services/transactionsService.js';

const goalId = '00000000-0000-4000-8000-0000000000bb';
const userId = '00000000-0000-4000-8000-0000000000cc';

describe('src/routes/transactions.js', () => {
  beforeEach(() => {
    vi.mocked(completeDeposit).mockClear();
    vi.mocked(completeWithdrawal).mockClear();
    vi.mocked(completeDeposit).mockResolvedValue({
      status: 'completed',
      deposit_transaction_id: 'tx-1',
      promo_bonus_transaction_id: null,
      bonus_ar: 0,
    });
    vi.mocked(completeWithdrawal).mockResolvedValue({
      status: 'completed',
      net_amount_ar: 1000,
      fee_ar: 500,
      total_debited_ar: 1500,
    });
  });

  function mountApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: userId, email: 'u@example.com' };
      next();
    });
    app.use('/:goalId', transactionRoutes);
    return app;
  }

  it('POST /deposits appelle completeDeposit et renvoie 201', async () => {
    const res = await request(mountApp())
      .post(`/${goalId}/deposits`)
      .send({ amount_ar: 5000, provider: 'mvola' });

    expect(res.status).toBe(HTTP_STATUS.CREATED);
    expect(completeDeposit).toHaveBeenCalledWith({
      goalId,
      userId,
      amountAr: 5000,
      provider: 'mvola',
      promoCodeRaw: undefined,
    });
  });

  it('POST /deposits en attente renvoie 202', async () => {
    vi.mocked(completeDeposit).mockResolvedValueOnce({
      status: 'pending',
      message: 'en attente',
    });

    const res = await request(mountApp())
      .post(`/${goalId}/deposits`)
      .send({ amount_ar: 1000, provider: 'orange_money' });

    expect(res.status).toBe(HTTP_STATUS.ACCEPTED);
  });

  it('POST /withdrawals appelle completeWithdrawal', async () => {
    const res = await request(mountApp())
      .post(`/${goalId}/withdrawals`)
      .send({ net_amount_ar: 2000 });

    expect(res.status).toBe(HTTP_STATUS.CREATED);
    expect(completeWithdrawal).toHaveBeenCalledWith({
      goalId,
      userId,
      netAmountAr: 2000,
    });
  });

  it('validation : montant dépôt invalide → 422', async () => {
    const res = await request(mountApp())
      .post(`/${goalId}/deposits`)
      .send({ amount_ar: 0, provider: 'mvola' });

    expect(res.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    expect(completeDeposit).not.toHaveBeenCalled();
  });
});
