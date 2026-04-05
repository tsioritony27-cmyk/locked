/**
 * Tests du module src/services/transactionsService.js (forte complexité cyclomatique).
 * Import explicite du module source pour l’analyse statique (Sonar / graphe de dépendances).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as transactionsService from '../../src/services/transactionsService.js';
import { completeDeposit, completeWithdrawal } from '../../src/services/transactionsService.js';
import { HTTP_STATUS } from '../../src/config/constants.js';
import { buildActiveGoalRow, createGoalsOnlyMock } from '../helpers/supabaseTransactionsMock.js';

describe('src/services/transactionsService.js', () => {
  it('réexporte les deux opérations métier publiques', () => {
    expect(transactionsService.completeDeposit).toBe(completeDeposit);
    expect(transactionsService.completeWithdrawal).toBe(completeWithdrawal);
    expect(typeof transactionsService.completeDeposit).toBe('function');
    expect(typeof transactionsService.completeWithdrawal).toBe('function');
  });

  describe('completeDeposit', () => {
    it('rejette un montant < 1 avant tout accès DB', async () => {
      await expect(
        completeDeposit({
          goalId: '00000000-0000-4000-8000-000000000001',
          userId: '00000000-0000-4000-8000-000000000002',
          amountAr: 0,
          provider: 'mvola',
          promoCodeRaw: null,
          externalRef: null,
        }),
      ).rejects.toMatchObject({ status: HTTP_STATUS.UNPROCESSABLE_ENTITY });
    });
  });

  describe('completeWithdrawal (avec mock Supabase)', () => {
    it('rejette un montant net < 1 après chargement de l’objectif', async () => {
      vi.resetModules();
      vi.doMock('../../src/lib/supabaseAdmin.js', () => createGoalsOnlyMock(buildActiveGoalRow()));

      const { completeWithdrawal: cw } = await import('../../src/services/transactionsService.js');

      await expect(
        cw({
          goalId: '00000000-0000-4000-8000-000000000001',
          userId: '00000000-0000-4000-8000-000000000002',
          netAmountAr: 0,
        }),
      ).rejects.toMatchObject({ status: HTTP_STATUS.UNPROCESSABLE_ENTITY });
    });

    it('rejette un objectif annulé (retrait)', async () => {
      vi.resetModules();
      vi.doMock('../../src/lib/supabaseAdmin.js', () =>
        createGoalsOnlyMock(buildActiveGoalRow({ status: 'cancelled' })),
      );

      const { completeWithdrawal: cw } = await import('../../src/services/transactionsService.js');

      await expect(
        cw({
          goalId: '00000000-0000-4000-8000-000000000001',
          userId: '00000000-0000-4000-8000-000000000002',
          netAmountAr: 5000,
        }),
      ).rejects.toMatchObject({ status: HTTP_STATUS.BAD_REQUEST });
    });
  });
});
