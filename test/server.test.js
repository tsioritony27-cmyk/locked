import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { startLockedApi } from '../src/server.js';

describe('server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startLockedApi appelle app.listen avec le port configuré', () => {
    const listenSpy = vi.spyOn(app, 'listen').mockReturnValue({ close: vi.fn() });

    startLockedApi();

    expect(listenSpy).toHaveBeenCalledWith(env.port, expect.any(Function));
  });
});
