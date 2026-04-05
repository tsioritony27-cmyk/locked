/**
 * Branche production de src/middleware/errorHandler.js (message générique pour les 500).
 */
import { describe, it, expect, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/config/constants.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    nodeEnv: 'production',
  },
}));

import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('src/middleware/errorHandler.js (production)', () => {
  it('masque le message pour une erreur 500', () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('secret stack'), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    errorHandler(err, { id: 'x' }, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      data: null,
      errors: [
        {
          code: 'DB_ERROR',
          message: 'Erreur interne.',
          field: undefined,
          request_id: 'x',
        },
      ],
    });
    logSpy.mockRestore();
  });
});
