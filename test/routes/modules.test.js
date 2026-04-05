import { describe, it, expect } from 'vitest';
import goalsRoutes from '../../src/routes/goals.js';
import promoRoutes from '../../src/routes/promo.js';
import loansRoutes from '../../src/routes/loans.js';
import profileRoutes from '../../src/routes/profile.js';
import transactionRoutes from '../../src/routes/transactions.js';

describe('modules de routes Express', () => {
  it('exporte un router pour chaque ressource', () => {
    for (const router of [
      goalsRoutes,
      promoRoutes,
      loansRoutes,
      profileRoutes,
      transactionRoutes,
    ]) {
      expect(router).toBeDefined();
      expect(Array.isArray(router.stack)).toBe(true);
    }
  });
});
