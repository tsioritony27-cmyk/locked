import { describe, it, expect } from 'vitest';
import { supabaseAdmin } from '../../src/lib/supabaseAdmin.js';

describe('supabaseAdmin', () => {
  it('exporte un client avec auth et from', () => {
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.from).toBe('function');
    expect(supabaseAdmin.auth).toBeDefined();
    expect(typeof supabaseAdmin.auth.getUser).toBe('function');
  });
});
