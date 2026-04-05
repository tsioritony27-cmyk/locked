import { describe, it, expect, vi } from 'vitest';
import { requestId } from '../../src/middleware/requestId.js';

describe('requestId', () => {
  it('fixe req.id et l’en-tête de réponse', () => {
    const req = { headers: {} };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestId(req, res, next);

    expect(typeof req.id).toBe('string');
    expect(req.id.length).toBeGreaterThan(10);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
    expect(next).toHaveBeenCalledWith();
  });

  it('réutilise x-request-id fourni', () => {
    const req = { headers: { 'x-request-id': 'abc-123' } };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestId(req, res, next);

    expect(req.id).toBe('abc-123');
  });
});
