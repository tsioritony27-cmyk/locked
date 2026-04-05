/**
 * Variables minimales avant tout import de src (env.js exige SUPABASE_*).
 * Limites de rate élevées pour les tests HTTP.
 */
process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'vitest-service-role-key-not-for-production';
process.env.NODE_ENV ??= 'test';
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.RATE_LIMIT_API_PER_MINUTE ??= '0';
