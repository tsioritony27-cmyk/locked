import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { requireAuth } from '../../src/middleware/auth.js';
import { supabaseAdmin } from '../../src/lib/supabaseAdmin.js';
import { HTTP_STATUS } from '../../src/config/constants.js';

describe('requireAuth', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.auth.getUser).mockReset();
  });

  it('répond 401 sans Bearer', async () => {
    const req = { headers: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next quand le jeton est valide', async () => {
    vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
      error: null,
    });

    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(req.user).toEqual({ id: 'u1', email: 'a@b.c' });
    expect(next).toHaveBeenCalledWith();
  });
});
