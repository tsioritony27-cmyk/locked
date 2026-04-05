import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Éligibilité prêt : 6 mois civils consécutifs avec au moins une activité
 * (dépôt ou retrait complété) chaque mois.
 */
export async function hasSixConsecutiveActiveMonths(userId) {
  const end = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 10));
  }

  const { data, error } = await supabaseAdmin
    .from('user_monthly_activity')
    .select('month_start, activity_count')
    .eq('user_id', userId)
    .in('month_start', months);

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });

  const map = new Map((data || []).map((r) => [r.month_start, r.activity_count]));
  for (const m of months) {
    const c = map.get(m);
    if (!c || c < 1) return false;
  }
  return true;
}
