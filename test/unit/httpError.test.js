import { describe, it, expect } from 'vitest';
import { httpError } from '../../src/lib/httpError.js';
import { HTTP_STATUS } from '../../src/config/constants.js';

describe('httpError', () => {
  it('attache status, code et message', () => {
    const err = httpError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Manquant');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Manquant');
  });

  it('ajoute field optionnel', () => {
    const err = httpError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'X', 'msg', 'body');
    expect(err.field).toBe('body');
  });
});
