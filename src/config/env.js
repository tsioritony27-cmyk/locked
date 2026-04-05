import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  withdrawalFeeAr: Number(process.env.WITHDRAWAL_FEE_AR) || 500,
  promoFirstDepositPercent: Number(process.env.PROMO_FIRST_DEPOSIT_PERCENT) || 20,
  promoWithdrawalMinProgressPercent:
    Number(process.env.PROMO_WITHDRAWAL_MIN_PROGRESS_PERCENT) || 80,
  paymentMode: (process.env.PAYMENT_MODE || 'mock').toLowerCase(),
};
