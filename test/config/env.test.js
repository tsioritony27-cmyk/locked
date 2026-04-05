import { describe, it, expect } from 'vitest';
import { env } from '../../src/config/env.js';

describe('env', () => {
  it('charge les clés Supabase et le port', () => {
    expect(env.supabaseUrl).toMatch(/^https?:\/\//);
    expect(env.supabaseServiceRoleKey.length).toBeGreaterThan(5);
    expect(typeof env.port).toBe('number');
  });

  it('expose les paramètres métier numériques', () => {
    expect(env.withdrawalFeeAr).toBeGreaterThanOrEqual(0);
    expect(env.promoFirstDepositPercent).toBeGreaterThan(0);
    expect(env.rateLimitWindowMs).toBeGreaterThan(0);
  });
});
