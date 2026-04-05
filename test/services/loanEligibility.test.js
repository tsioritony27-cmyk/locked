/**
 * Tests associés à src/services/loanEligibility.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ISO_DATE_PREFIX_LENGTH,
  LOAN_ELIGIBILITY_CONSECUTIVE_MONTHS,
} from '../../src/config/constants.js';

function expectedMonthKeys() {
  const end = new Date();
  const months = [];
  for (let i = 0; i < LOAN_ELIGIBILITY_CONSECUTIVE_MONTHS; i++) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, ISO_DATE_PREFIX_LENGTH));
  }
  return months;
}

vi.mock('../../src/lib/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from '../../src/lib/supabaseAdmin.js';
import { hasSixConsecutiveActiveMonths } from '../../src/services/loanEligibility.js';

describe('src/services/loanEligibility.js', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: expectedMonthKeys().map((month_start) => ({ month_start, activity_count: 1 })),
        error: null,
      }),
    }));
  });

  it('retourne true si six mois consécutifs ont une activité', async () => {
    await expect(hasSixConsecutiveActiveMonths('user-1')).resolves.toBe(true);
  });

  it('retourne false si un mois manque dans les données', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    await expect(hasSixConsecutiveActiveMonths('user-1')).resolves.toBe(false);
  });
});
