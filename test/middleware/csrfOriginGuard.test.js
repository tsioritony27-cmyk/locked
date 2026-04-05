import { describe, it, expect, vi } from 'vitest';
import { csrfOriginGuard } from '../../src/middleware/csrfOriginGuard.js';

/**
 * En test, CORS_ORIGINS est vide : le garde laisse passer les POST sans Origin
 * (curl, apps natives). On vérifie surtout que GET n’est pas bloqué.
 */
describe('csrfOriginGuard', () => {
  it('laisse passer GET', () => {
    const req = { method: 'GET', get: vi.fn() };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    csrfOriginGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('laisse passer POST sans en-tête Origin', () => {
    const req = { method: 'POST', get: vi.fn(() => undefined) };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    csrfOriginGuard(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
