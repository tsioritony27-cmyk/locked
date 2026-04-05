import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { env } from '../config/env.js';
import {
  HTTP_STATUS,
  ISO_DATE_PREFIX_LENGTH,
  MIN_AMOUNT_AR,
  PERCENT_DIVISOR,
} from '../config/constants.js';
import { httpError } from '../lib/httpError.js';
import { levelFromLifetimeDeposits } from './levels.js';

function calculatePromoMinBalanceAr(targetAmountAr) {
  return Math.floor(
    (Number(targetAmountAr) * env.promoWithdrawalMinProgressPercent) / PERCENT_DIVISOR,
  );
}

/** Premier jour du mois UTC pour le comptage d’activité fréquente. */
function getUtcMonthStartIsoString(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, ISO_DATE_PREFIX_LENGTH);
}

async function incrementUserMonthlyActivity(userId) {
  const monthStart = getUtcMonthStartIsoString();
  const { data: existing } = await supabaseAdmin
    .from('user_monthly_activity')
    .select('activity_count')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle();

  let previousCount = 0;
  if (existing != null && existing.activity_count != null) {
    const n = Number(existing.activity_count);
    if (Number.isFinite(n)) previousCount = n;
  }
  const next = previousCount + 1;

  const { error } = await supabaseAdmin.from('user_monthly_activity').upsert(
    {
      user_id: userId,
      month_start: monthStart,
      activity_count: next,
    },
    { onConflict: 'user_id,month_start' },
  );

  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
}

async function ensureGoalBelongsToUser(goalId, userId) {
  const { data: goal, error } = await supabaseAdmin
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  if (!goal) throw httpError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Objectif introuvable.');
  return goal;
}

async function countCompletedUserDeposits(userId) {
  const { count, error } = await supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'deposit')
    .eq('status', 'completed');

  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  return count == null ? 0 : count;
}

async function resolvePromoForFirstDeposit({ userId, goalId, promoCodeRaw, depositAmountAr }) {
  if (!promoCodeRaw) return { bonusAr: 0, promoCodeId: null, requires80: false };

  const code = String(promoCodeRaw).trim().toUpperCase();
  const completedDeposits = await countCompletedUserDeposits(userId);
  if (completedDeposits > 0) {
    throw httpError(
      HTTP_STATUS.BAD_REQUEST,
      'PROMO_NOT_FIRST_DEPOSIT',
      'Le code promo s’applique uniquement au premier dépôt.',
      'promo_code',
    );
  }

  const { data: promo, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  if (!promo || !promo.active) {
    throw httpError(
      HTTP_STATUS.BAD_REQUEST,
      'PROMO_INVALID',
      'Code promo invalide ou inactif.',
      'promo_code',
    );
  }
  if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
    throw httpError(HTTP_STATUS.BAD_REQUEST, 'PROMO_EXHAUSTED', 'Code promo épuisé.', 'promo_code');
  }

  const { data: existingRedemption } = await supabaseAdmin
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_code_id', promo.id)
    .maybeSingle();

  if (existingRedemption) {
    throw httpError(
      HTTP_STATUS.BAD_REQUEST,
      'PROMO_ALREADY_USED',
      'Vous avez déjà utilisé ce code.',
      'promo_code',
    );
  }

  const bonusAr = Math.floor((depositAmountAr * promo.percent_first_deposit) / PERCENT_DIVISOR);

  return {
    bonusAr,
    promoCodeId: promo.id,
    requires80: true,
    percent: promo.percent_first_deposit,
  };
}

async function insertTransactionRow({
  goalId,
  userId,
  amountAr,
  provider,
  externalRef,
  status,
  type = 'deposit',
  feeAr = 0,
  meta = {},
}) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      goal_id: goalId,
      user_id: userId,
      type,
      amount_ar: amountAr,
      fee_ar: feeAr,
      provider,
      external_ref: externalRef,
      status,
      meta,
    })
    .select('id')
    .single();

  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  return data.id;
}

async function updateGoalBalance(goalId, delta) {
  const { data: g, error: fetchErr } = await supabaseAdmin
    .from('goals')
    .select('balance_ar')
    .eq('id', goalId)
    .single();
  if (fetchErr)
    throw Object.assign(new Error(fetchErr.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });

  const next = Number(g.balance_ar) + delta;
  if (next < 0)
    throw httpError(HTTP_STATUS.BAD_REQUEST, 'INSUFFICIENT_BALANCE', 'Solde insuffisant.');

  const { error } = await supabaseAdmin
    .from('goals')
    .update({ balance_ar: next, updated_at: new Date().toISOString() })
    .eq('id', goalId);
  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
}

async function incrementProfileDeposits(userId, depositAmountOnly) {
  const { data: p, error: fe } = await supabaseAdmin
    .from('profiles')
    .select('lifetime_deposits_ar')
    .eq('id', userId)
    .single();
  if (fe)
    throw Object.assign(new Error(fe.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });

  const lifetime = Number(p.lifetime_deposits_ar) + depositAmountOnly;
  const level = levelFromLifetimeDeposits(lifetime);

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      lifetime_deposits_ar: lifetime,
      level,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
}

async function incrementPromoUses(promoCodeId) {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('promo_codes')
    .select('uses_count')
    .eq('id', promoCodeId)
    .single();
  if (fetchErr)
    throw Object.assign(new Error(fetchErr.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  if (!row) return;

  const { error } = await supabaseAdmin
    .from('promo_codes')
    .update({ uses_count: Number(row.uses_count) + 1 })
    .eq('id', promoCodeId);
  if (error)
    throw Object.assign(new Error(error.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
}

async function createPendingDepositResponse({
  goalId,
  userId,
  amountAr,
  provider,
  ref,
  promoCodeRaw,
}) {
  await insertTransactionRow({
    goalId,
    userId,
    amountAr,
    provider,
    externalRef: ref,
    status: 'pending',
    meta: { promo_requested: Boolean(promoCodeRaw) },
  });
  return {
    status: 'pending',
    message:
      'Paiement en attente de confirmation opérateur (configurez PAYMENT_MODE=mock pour les tests).',
  };
}

async function recordPromoBonusIfApplicable({ goal, goalId, userId, promo, txDepositId }) {
  if (!promo.promoCodeId || promo.bonusAr <= 0) return null;

  const bonusTxId = await insertTransactionRow({
    goalId,
    userId,
    amountAr: promo.bonusAr,
    provider: 'internal',
    externalRef: null,
    status: 'completed',
    type: 'promo_bonus',
    meta: { promo_code_id: promo.promoCodeId, parent_deposit_tx: txDepositId },
  });

  const { error: redemptionErr } = await supabaseAdmin.from('promo_redemptions').insert({
    user_id: userId,
    promo_code_id: promo.promoCodeId,
    goal_id: goalId,
    bonus_amount_ar: promo.bonusAr,
  });
  if (redemptionErr) {
    throw Object.assign(new Error(redemptionErr.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  }

  await incrementPromoUses(promo.promoCodeId);

  const { error: goalPromoErr } = await supabaseAdmin
    .from('goals')
    .update({
      promo_code_id: promo.promoCodeId,
      promo_bonus_ar: Number(goal.promo_bonus_ar || 0) + promo.bonusAr,
      promo_requires_80_percent: promo.requires80,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId);
  if (goalPromoErr) {
    throw Object.assign(new Error(goalPromoErr.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  }

  return bonusTxId;
}

async function markGoalCompletedIfTargetReached(goalId) {
  const { data: updatedGoal, error: goalFetchErr } = await supabaseAdmin
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();
  if (goalFetchErr) {
    throw Object.assign(new Error(goalFetchErr.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  }

  const reached =
    updatedGoal && Number(updatedGoal.balance_ar) >= Number(updatedGoal.target_amount_ar);
  if (!reached) return;

  const { error: completeErr } = await supabaseAdmin
    .from('goals')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', goalId);
  if (completeErr) {
    throw Object.assign(new Error(completeErr.message), {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: 'DB_ERROR',
    });
  }
}

/**
 * Enregistre un dépôt déjà confirmé (solde, profil, activité, objectif complété si besoin).
 */
async function finalizeCompletedDeposit({
  goalId,
  userId,
  amountAr,
  provider,
  externalRef,
  goal,
  promo,
}) {
  const txDepositId = await insertTransactionRow({
    goalId,
    userId,
    amountAr,
    provider,
    externalRef,
    status: 'completed',
  });

  const bonusTxId = await recordPromoBonusIfApplicable({
    goal,
    goalId,
    userId,
    promo,
    txDepositId,
  });

  await updateGoalBalance(goalId, amountAr + (promo.bonusAr || 0));
  await incrementProfileDeposits(userId, amountAr);
  await incrementUserMonthlyActivity(userId);
  await markGoalCompletedIfTargetReached(goalId);

  return {
    status: 'completed',
    deposit_transaction_id: txDepositId,
    promo_bonus_transaction_id: bonusTxId,
    bonus_ar: promo.bonusAr || 0,
  };
}

/**
 * Dépôt complété (mock ou après webhook opérateur).
 */
export async function completeDeposit({
  goalId,
  userId,
  amountAr,
  provider,
  promoCodeRaw,
  externalRef,
}) {
  if (amountAr < MIN_AMOUNT_AR) {
    throw httpError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      'VALIDATION',
      'Montant invalide.',
      'amount_ar',
    );
  }

  const goal = await ensureGoalBelongsToUser(goalId, userId);
  if (goal.status !== 'active') {
    throw httpError(HTTP_STATUS.BAD_REQUEST, 'GOAL_NOT_ACTIVE', 'Objectif non actif.');
  }

  const promo = await resolvePromoForFirstDeposit({
    userId,
    goalId,
    promoCodeRaw,
    depositAmountAr: amountAr,
  });

  const paymentCompleted = env.paymentMode === 'mock';
  const ref = externalRef || (paymentCompleted ? `mock_${Date.now()}` : null);

  if (!paymentCompleted) {
    return createPendingDepositResponse({
      goalId,
      userId,
      amountAr,
      provider,
      ref,
      promoCodeRaw,
    });
  }

  return finalizeCompletedDeposit({
    goalId,
    userId,
    amountAr,
    provider,
    externalRef: ref,
    goal,
    promo,
  });
}

function validateWithdrawalAgainstGoalRules(goal, netAmountAr) {
  if (goal.status === 'cancelled') {
    throw httpError(HTTP_STATUS.BAD_REQUEST, 'GOAL_CANCELLED', 'Objectif annulé.');
  }

  const deadline = new Date(goal.deadline);
  if (Date.now() < deadline.getTime()) {
    throw httpError(
      HTTP_STATUS.FORBIDDEN,
      'LOCKED_UNTIL_DEADLINE',
      'Retrait impossible avant la date limite fixée pour cet objectif.',
    );
  }

  if (goal.promo_requires_80_percent) {
    const minBal = calculatePromoMinBalanceAr(goal.target_amount_ar);
    if (Number(goal.balance_ar) < minBal) {
      throw httpError(
        HTTP_STATUS.FORBIDDEN,
        'PROMO_PROGRESS_REQUIRED',
        `Avec ce code promo, le retrait n’est possible qu’à partir de ${env.promoWithdrawalMinProgressPercent} % de l’objectif (${minBal} Ar sur la tirelire).`,
      );
    }
  }

  if (netAmountAr < MIN_AMOUNT_AR) {
    throw httpError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      'VALIDATION',
      'Montant invalide.',
      'amount_ar',
    );
  }

  const fee = env.withdrawalFeeAr;
  const totalDebit = netAmountAr + fee;
  if (Number(goal.balance_ar) < totalDebit) {
    throw httpError(
      HTTP_STATUS.BAD_REQUEST,
      'INSUFFICIENT_BALANCE',
      'Solde insuffisant (montant + frais de retrait).',
    );
  }

  return { fee, totalDebit };
}

async function createPendingWithdrawalResponse({ goalId, userId, netAmountAr, fee, ref }) {
  await insertTransactionRow({
    goalId,
    userId,
    amountAr: netAmountAr,
    provider: 'internal',
    externalRef: ref,
    status: 'pending',
    type: 'withdrawal',
    meta: { fee_ar: fee, note: 'en_attente_payout' },
  });
  return {
    status: 'pending',
    message: 'Retrait initié — confirmation opérateur requise.',
  };
}

async function executeCompletedWithdrawal({ goalId, userId, netAmountAr, fee, ref, totalDebit }) {
  await insertTransactionRow({
    goalId,
    userId,
    amountAr: netAmountAr,
    provider: 'internal',
    externalRef: ref,
    status: 'completed',
    type: 'withdrawal',
    meta: { fee_ar: fee },
  });

  await insertTransactionRow({
    goalId,
    userId,
    amountAr: fee,
    provider: 'internal',
    externalRef: `${ref}_fee`,
    status: 'completed',
    type: 'withdrawal_fee',
    meta: { parent_withdrawal_ref: ref },
  });

  await updateGoalBalance(goalId, -totalDebit);
  await incrementUserMonthlyActivity(userId);

  return {
    status: 'completed',
    net_amount_ar: netAmountAr,
    fee_ar: fee,
    total_debited_ar: totalDebit,
  };
}

/**
 * Retrait : net vers mobile money ; débit objectif = net + frais.
 */
export async function completeWithdrawal({ goalId, userId, netAmountAr }) {
  const goal = await ensureGoalBelongsToUser(goalId, userId);
  const { fee, totalDebit } = validateWithdrawalAgainstGoalRules(goal, netAmountAr);

  const paymentCompleted = env.paymentMode === 'mock';
  const ref = paymentCompleted ? `mock_w_${Date.now()}` : null;

  if (!paymentCompleted) {
    return createPendingWithdrawalResponse({
      goalId,
      userId,
      netAmountAr,
      fee,
      ref,
    });
  }

  return executeCompletedWithdrawal({
    goalId,
    userId,
    netAmountAr,
    fee,
    ref,
    totalDebit,
  });
}
