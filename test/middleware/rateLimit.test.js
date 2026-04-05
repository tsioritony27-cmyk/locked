import { describe, it, expect } from 'vitest';
import { globalRateLimiter, apiV1BurstLimiter } from '../../src/middleware/rateLimit.js';

describe('rateLimit', () => {
  it('exporte le limiteur global (middleware Express)', () => {
    expect(typeof globalRateLimiter).toBe('function');
  });

  it('désactive le burst /api/v1 quand RATE_LIMIT_API_PER_MINUTE vaut 0', () => {
    expect(apiV1BurstLimiter).toBeNull();
  });
});
