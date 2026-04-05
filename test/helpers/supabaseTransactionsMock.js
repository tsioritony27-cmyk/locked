import { vi } from 'vitest';

/** Objectif actif, échéance passée, solde suffisant pour des scénarios de retrait / dépôt */
export function buildActiveGoalRow(overrides = {}) {
  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: '00000000-0000-4000-8000-000000000002',
    status: 'active',
    balance_ar: 100_000,
    target_amount_ar: 500_000,
    deadline: past,
    promo_requires_80_percent: false,
    promo_bonus_ar: 0,
    ...overrides,
  };
}

/**
 * Mock minimal pour ensureGoalBelongsToUser + chaînes terminées par maybeSingle/single/update.
 */
export function createGoalsOnlyMock(goalRow) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: goalRow, error: null });
  const single = vi.fn().mockResolvedValue({ data: goalRow, error: null });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
    single,
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  };
  chain.update.mockResolvedValue({ error: null });

  return {
    supabaseAdmin: {
      from: vi.fn((table) => {
        if (table === 'goals') return chain;
        return {
          select: vi.fn(),
        };
      }),
      auth: { getUser: vi.fn() },
    },
  };
}
