import dotenv from 'dotenv';
import {
  DEFAULT_PORT,
  DEFAULT_PROMO_FIRST_DEPOSIT_PERCENT,
  DEFAULT_PROMO_WITHDRAWAL_MIN_PROGRESS_PERCENT,
  DEFAULT_RATE_LIMIT_API_PER_MINUTE,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MINUTES,
  DEFAULT_WITHDRAWAL_FEE_AR,
  MS_PER_MINUTE,
} from './constants.js';

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT) || DEFAULT_PORT,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  withdrawalFeeAr: Number(process.env.WITHDRAWAL_FEE_AR) || DEFAULT_WITHDRAWAL_FEE_AR,
  promoFirstDepositPercent:
    Number(process.env.PROMO_FIRST_DEPOSIT_PERCENT) || DEFAULT_PROMO_FIRST_DEPOSIT_PERCENT,
  promoWithdrawalMinProgressPercent:
    Number(process.env.PROMO_WITHDRAWAL_MIN_PROGRESS_PERCENT) ||
    DEFAULT_PROMO_WITHDRAWAL_MIN_PROGRESS_PERCENT,
  paymentMode: (process.env.PAYMENT_MODE || 'mock').toLowerCase(),
  rateLimitWindowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_RATE_LIMIT_WINDOW_MINUTES * MS_PER_MINUTE,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT_MAX,
  /** 0 = désactive le burst limiter sur /api/v1 */
  rateLimitApiPerMinute: (() => {
    const raw = process.env.RATE_LIMIT_API_PER_MINUTE;
    if (raw === undefined || raw === '') return DEFAULT_RATE_LIMIT_API_PER_MINUTE;
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEFAULT_RATE_LIMIT_API_PER_MINUTE;
  })(),
};
