import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { HEALTH_CHECK_PATH, HTTP_STATUS } from '../../src/config/constants.js';

describe('app (HTTP)', () => {
  it('GET health renvoie ok', async () => {
    const res = await request(app).get(HEALTH_CHECK_PATH);
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data?.ok).toBe(true);
  });

  it('route inconnue → 404 JSON', async () => {
    const res = await request(app).get('/introuvable-xyz');
    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(res.body.errors?.[0]?.code).toBe('NOT_FOUND');
  });
});
