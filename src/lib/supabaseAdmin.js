import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/** Client serveur (service role) — ne jamais exposer la clé au client. */
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
