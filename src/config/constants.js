/** Codes HTTP réutilisés par l’API */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

/** Défauts serveur (surchargés par les variables d’environnement) */
export const DEFAULT_PORT = 3000;
export const MS_PER_MINUTE = 60_000;
export const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 15;
export const DEFAULT_WITHDRAWAL_FEE_AR = 500;
export const DEFAULT_PROMO_FIRST_DEPOSIT_PERCENT = 20;
export const DEFAULT_PROMO_WITHDRAWAL_MIN_PROGRESS_PERCENT = 80;
export const DEFAULT_RATE_LIMIT_MAX = 300;
export const DEFAULT_RATE_LIMIT_API_PER_MINUTE = 90;

/** Pourcentages : base 100 */
export const PERCENT_DIVISOR = 100;

/** Progression objectif : deux décimales via round(ratio × scale) / PERCENT_DIVISOR */
export const PROGRESS_RATIO_SCALE = 10_000;
export const FULL_PERCENT = 100;

/** Champs métier */
export const GOAL_TITLE_MAX_LENGTH = 200;
export const PROFILE_PHONE_MAX_LENGTH = 32;
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 120;
export const PROMO_CODE_MIN_LENGTH = 4;
export const PROMO_CODE_MAX_LENGTH = 32;

/** Montants entiers minimum (Ariary) */
export const MIN_AMOUNT_AR = 1;

/** Prêt : mois civils consécutifs avec activité */
export const LOAN_ELIGIBILITY_CONSECUTIVE_MONTHS = 6;
export const MIN_MONTHLY_ACTIVITY_COUNT = 1;

/** Postgres : violation contrainte unique */
export const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Préfixe Authorization (longueur pour extraire le jeton) */
export const BEARER_PREFIX = 'Bearer ';

/** Route health check */
export const HEALTH_CHECK_PATH = '/health';

/** Préfixe date ISO YYYY-MM-DD */
export const ISO_DATE_PREFIX_LENGTH = 10;
