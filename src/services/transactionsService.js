import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { env } from '../config/env.js';
import { httpError } from '../lib/httpError.js';
import { levelFromLifetimeDeposits } from './levels.js';
import { bumpMonthlyActivity } from './activity.js';

function min80PercentTarget(targetAmountAr) {
  return Math.floor((Number(targetAmountAr) * env.promoWithdrawalMinProgressPercent) / 100);
}

export async function assertGoalOwned(goalId, userId) {
  const { data: goal, error } = await supabaseAdmin
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
  if (!goal) throw httpError(404, 'NOT_FOUND', 'Objectif introuvable.');
  return goal;
}

async function countCompletedUserDeposits(userId) {
  const { count, error } = await supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'deposit')
    .eq('status', 'completed');

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
  return count ?? 0;
}

export async function resolvePromoForFirstDeposit({
  userId,
  goalId,
  promoCodeRaw,
  depositAmountAr,
}) {
  if (!promoCodeRaw) return { bonusAr: 0, promoCodeId: null, requires80: false };

  const code = String(promoCodeRaw).trim().toUpperCase();
  const completedDeposits = await countCompletedUserDeposits(userId);
  if (completedDeposits > 0) {
    throw httpError(400, 'PROMO_NOT_FIRST_DEPOSIT', 'Le code promo s’applique uniquement au premier dépôt.', 'promo_code');
  }

  const { data: promo, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
  if (!promo || !promo.active) {
    throw httpError(400, 'PROMO_INVALID', 'Code promo invalide ou inactif.', 'promo_code');
  }
  if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
    throw httpError(400, 'PROMO_EXHAUSTED', 'Code promo épuisé.', 'promo_code');
  }

  const { data: existingRedemption } = await supabaseAdmin
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_code_id', promo.id)
    .maybeSingle();

  if (existingRedemption) {
    throw httpError(400, 'PROMO_ALREADY_USED', 'Vous avez déjà utilisé ce code.', 'promo_code');
  }

  const bonusAr = Math.floor((depositAmountAr * promo.percent_first_deposit) / 100);

  return {
    bonusAr,
    promoCodeId: promo.id,
    requires80: true,
    percent: promo.percent_first_deposit,
  };
}

async function persistDepositRow({
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

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
  return data.id;
}

async function updateGoalBalance(goalId, delta) {
  const { data: g, error: fetchErr } = await supabaseAdmin
    .from('goals')
    .select('balance_ar')
    .eq('id', goalId)
    .single();
  if (fetchErr) throw Object.assign(new Error(fetchErr.message), { status: 500, code: 'DB_ERROR' });

  const next = Number(g.balance_ar) + delta;
  if (next < 0) throw httpError(400, 'INSUFFICIENT_BALANCE', 'Solde insuffisant.');

  const { error } = await supabaseAdmin
    .from('goals')
    .update({ balance_ar: next, updated_at: new Date().toISOString() })
    .eq('id', goalId);
  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
}

async function incrementProfileDeposits(userId, depositAmountOnly) {
  const { data: p, error: fe } = await supabaseAdmin
    .from('profiles')
    .select('lifetime_deposits_ar')
    .eq('id', userId)
    .single();
  if (fe) throw Object.assign(new Error(fe.message), { status: 500, code: 'DB_ERROR' });

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

  if (error) throw Object.assign(new Error(error.message), { status: 500, code: 'DB_ERROR' });
}

async function incrementPromoUses(promoCodeId) {
  const { data: row } = await supabaseAdmin
    .from('promo_codes')
    .select('uses_count')
    .eq('id', promoCodeId)
    .single();
  if (!row) return;
  await supabaseAdmin
    .from('promo_codes')
    .update({ uses_count: Number(row.uses_count) + 1 })
    .eq('id', promoCodeId);
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
  if (amountAr < 1) throw httpError(422, 'VALIDATION', 'Montant invalide.', 'amount_ar');

  const goal = await assertGoalOwned(goalId, userId);
  if (goal.status !== 'active') throw httpError(400, 'GOAL_NOT_ACTIVE', 'Objectif non actif.');

  const promo = await resolvePromoForFirstDeposit({
    userId,
    goalId,
    promoCodeRaw,
    depositAmountAr: amountAr,
  });

  const status = env.paymentMode === 'mock' ? 'completed' : 'pending';
  const ref = externalRef || (env.paymentMode === 'mock' ? `mock_${Date.now()}` : null);

  if (status === 'pending') {
    await persistDepositRow({
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

  const txDepositId = await persistDepositRow({
    goalId,
    userId,
    amountAr,
    provider,
    externalRef: ref,
    status: 'completed',
  });

  let bonusTxId = null;
  if (promo.promoCodeId && promo.bonusAr > 0) {
    bonusTxId = await persistDepositRow({
      goalId,
      userId,
      amountAr: promo.bonusAr,
      provider: 'internal',
      externalRef: null,
      status: 'completed',
      type: 'promo_bonus',
      meta: { promo_code_id: promo.promoCodeId, parent_deposit_tx: txDepositId },
    });

    await supabaseAdmin
      .from('promo_redemptions')
      .insert({
        user_id: userId,
        promo_code_id: promo.promoCodeId,
        goal_id: goalId,
        bonus_amount_ar: promo.bonusAr,
      });

    await incrementPromoUses(promo.promoCodeId);

    await supabaseAdmin
      .from('goals')
      .update({
        promo_code_id: promo.promoCodeId,
        promo_bonus_ar: Number(goal.promo_bonus_ar || 0) + promo.bonusAr,
        promo_requires_80_percent: promo.requires80,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId);
  }

  await updateGoalBalance(goalId, amountAr + (promo.bonusAr || 0));
  await incrementProfileDeposits(userId, amountAr);
  await bumpMonthlyActivity(userId);

  const { data: updatedGoal } = await supabaseAdmin
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (updatedGoal && Number(updatedGoal.balance_ar) >= Number(updatedGoal.target_amount_ar)) {
    await supabaseAdmin
      .from('goals')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', goalId);
  }

  return {
    status: 'completed',
    deposit_transaction_id: txDepositId,
    promo_bonus_transaction_id: bonusTxId,
    bonus_ar: promo.bonusAr || 0,
  };
}

/**
 * Retrait : net vers mobile money ; débit objectif = net + frais.
 */
export async function completeWithdrawal({ goalId, userId, netAmountAr }) {
  const goal = await assertGoalOwned(goalId, userId);
  if (goal.status === 'cancelled') throw httpError(400, 'GOAL_CANCELLED', 'Objectif annulé.');

  const deadline = new Date(goal.deadline);
  if (Date.now() < deadline.getTime()) {
    throw httpError(
      403,
      'LOCKED_UNTIL_DEADLINE',
      'Retrait impossible avant la date limite fixée pour cet objectif.',
    );
  }

  if (goal.promo_requires_80_percent) {
    const minBal = min80PercentTarget(goal.target_amount_ar);
    if (Number(goal.balance_ar) < minBal) {
      throw httpError(
        403,
        'PROMO_PROGRESS_REQUIRED',
        `Avec ce code promo, le retrait n’est possible qu’à partir de ${env.promoWithdrawalMinProgressPercent} % de l’objectif (${minBal} Ar sur la tirelire).`,
      );
    }
  }

  if (netAmountAr < 1) throw httpError(422, 'VALIDATION', 'Montant invalide.', 'amount_ar');

  const fee = env.withdrawalFeeAr;
  const totalDebit = netAmountAr + fee;
  if (Number(goal.balance_ar) < totalDebit) {
    throw httpError(400, 'INSUFFICIENT_BALANCE', 'Solde insuffisant (montant + frais de retrait).');
  }

  const status = env.paymentMode === 'mock' ? 'completed' : 'pending';
  const ref = env.paymentMode === 'mock' ? `mock_w_${Date.now()}` : null;

  if (status === 'pending') {
    await persistDepositRow({
      goalId,
      userId,
      amountAr: netAmountAr,
      provider: 'internal',
      externalRef: ref,
      status: 'pending',
      type: 'withdrawal',
      meta: { fee_ar: fee, note: 'en_attente_payout' },
    });
    return { status: 'pending', message: 'Retrait initié — confirmation opérateur requise.' };
  }

  await persistDepositRow({
    goalId,
    userId,
    amountAr: netAmountAr,
    provider: 'internal',
    externalRef: ref,
    status: 'completed',
    type: 'withdrawal',
    meta: { fee_ar: fee },
  });

  await persistDepositRow({
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
  await bumpMonthlyActivity(userId);

  return {
    status: 'completed',
    net_amount_ar: netAmountAr,
    fee_ar: fee,
    total_debited_ar: totalDebit,
  };
}
