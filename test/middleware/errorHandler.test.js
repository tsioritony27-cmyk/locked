/**
 * Tests associés à src/middleware/errorHandler.js
 */
import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { HTTP_STATUS } from '../../src/config/constants.js';

describe('src/middleware/errorHandler.js', () => {
  it('répond JSON avec le statut de l’erreur', () => {
    const err = Object.assign(new Error('oops'), { status: HTTP_STATUS.BAD_REQUEST, code: 'X' });
    const req = { id: 'rid' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      data: null,
      errors: [{ code: 'X', message: 'oops', field: undefined, request_id: 'rid' }],
    });
  });

  it('défaut statut 500 si absent sur l’erreur', () => {
    const err = new Error('sans status');
    const req = { id: 'r2' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
  });
});
