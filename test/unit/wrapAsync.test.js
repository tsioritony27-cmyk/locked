import { describe, it, expect, vi } from 'vitest';
import { wrapAsync } from '../../src/lib/wrapAsync.js';

describe('wrapAsync', () => {
  it('transmet les erreurs async à next', async () => {
    const err = new Error('boom');
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = wrapAsync(fn);
    const next = vi.fn();
    const req = {};
    const res = {};

    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('ne appelle pas next en cas de succès', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const wrapped = wrapAsync(fn);
    const next = vi.fn();

    await wrapped({}, {}, next);

    expect(next).not.toHaveBeenCalled();
  });
});
