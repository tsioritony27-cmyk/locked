import { describe, it, expect } from 'vitest';
import {
  BEARER_PREFIX,
  DEFAULT_PORT,
  HEALTH_CHECK_PATH,
  HTTP_STATUS,
  MIN_AMOUNT_AR,
} from '../../src/config/constants.js';

describe('constants', () => {
  it('expose les codes HTTP usuels', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
  });

  it('expose les constantes applicatives', () => {
    expect(typeof DEFAULT_PORT).toBe('number');
    expect(MIN_AMOUNT_AR).toBeGreaterThanOrEqual(1);
    expect(HEALTH_CHECK_PATH).toBe('/health');
    expect(BEARER_PREFIX).toBe('Bearer ');
  });
});
