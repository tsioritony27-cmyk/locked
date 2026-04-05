import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/** Premier jour du mois UTC pour le comptage d’activité fréquente. */
export function monthStartUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/**
 * Incrémente l’activité du mois courant (appelé après transaction complétée).
 */
export async function bumpMonthlyActivity(userId) {
  const monthStart = monthStartUtc();
  const { data: existing } = await supabaseAdmin
    .from('user_monthly_activity')
    .select('activity_count')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle();

  const next = (existing?.activity_count ?? 0) + 1;

  const { error } = await supabaseAdmin.from('user_monthly_activity').upsert(
    {
      user_id: userId,
      month_start: monthStart,
      activity_count: next,
    },
    { onConflict: 'user_id,month_start' },
  );

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
}
