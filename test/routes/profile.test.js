/**
 * Tests associés à src/routes/profile.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import profileRoutes from '../../src/routes/profile.js';
import { HTTP_STATUS } from '../../src/config/constants.js';

vi.mock('../../src/lib/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../src/services/loanEligibility.js', () => ({
  hasSixConsecutiveActiveMonths: vi.fn().mockResolvedValue(true),
}));

import { supabaseAdmin } from '../../src/lib/supabaseAdmin.js';

const userId = '00000000-0000-4000-8000-0000000000aa';

const profileRow = {
  id: userId,
  phone: '+261340000000',
  display_name: 'Testeur',
  lifetime_deposits_ar: 50_000,
  level: 'classic',
};

describe('src/routes/profile.js', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
    }));
  });

  function mountApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: userId, email: 't@example.com' };
      next();
    });
    app.use('/', profileRoutes);
    return app;
  }

  it('GET / renvoie le profil avec niveau et éligibilité prêt', async () => {
    const res = await request(mountApp()).get('/');

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data.profile.id).toBe(userId);
    expect(res.body.data.profile.level_progress).toBeDefined();
    expect(res.body.data.profile.loan_eligible).toBe(true);
  });

  it('GET / renvoie 404 si profil absent', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const res = await request(mountApp()).get('/');

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
  });

  it('PATCH / met à jour un champ', async () => {
    const res = await request(mountApp()).patch('/').send({ phone: '  0340000001  ' });

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data.profile).toBeDefined();
  });

  it('PATCH / 422 si aucun champ', async () => {
    const res = await request(mountApp()).patch('/').send({});

    expect(res.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
  });
});
