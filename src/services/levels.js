/**
 * Niveaux en fonction du cumul de dépôts (colonne lifetime_deposits_ar), en Ariary.
 * Ajustez les seuils selon votre produit.
 */
const THRESHOLDS = [
  { min: 0, level: 'standard' },
  { min: 100_000, level: 'classic' },
  { min: 500_000, level: 'gold' },
  { min: 2_000_000, level: 'premier' },
  { min: 10_000_000, level: 'world_elite' },
  { min: 50_000_000, level: 'infinite' },
];

export function levelFromLifetimeDeposits(lifetimeDepositsAr) {
  const n = Number(lifetimeDepositsAr) || 0;
  let current = THRESHOLDS[0].level;
  for (const row of THRESHOLDS) {
    if (n >= row.min) current = row.level;
  }
  return current;
}

export function nextLevelInfo(lifetimeDepositsAr) {
  const n = Number(lifetimeDepositsAr) || 0;
  let idx = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (n >= THRESHOLDS[i].min) idx = i;
  }
  const current = THRESHOLDS[idx].level;
  const nextThreshold = THRESHOLDS[idx + 1];
  const nextLevel = nextThreshold ? nextThreshold.level : null;

  return {
    current_level: current,
    next_level: nextLevel,
    amount_to_next_level_ar: nextThreshold ? Math.max(0, nextThreshold.min - n) : 0,
  };
}
