import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { HEALTH_CHECK_PATH, HTTP_STATUS } from './config/constants.js';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfOriginGuard } from './middleware/csrfOriginGuard.js';
import { apiV1BurstLimiter, globalRateLimiter } from './middleware/rateLimit.js';

import goalsRoutes from './routes/goals.js';
import transactionRoutes from './routes/transactions.js';
import promoRoutes from './routes/promo.js';
import loansRoutes from './routes/loans.js';
import profileRoutes from './routes/profile.js';

function resolveCorsOrigin() {
  if (env.corsOrigins.length > 0) {
    return env.corsOrigins;
  }
  if (env.nodeEnv === 'development') {
    return true;
  }
  return false;
}

const app = express();

app.set('trust proxy', 1);
app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: resolveCorsOrigin(),
    credentials: true,
  }),
);
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(globalRateLimiter);
app.use(express.json({ limit: '256kb' }));
app.use(csrfOriginGuard);

app.get(HEALTH_CHECK_PATH, (_req, res) => {
  res.json({ data: { ok: true, service: 'locked-api' }, errors: [] });
});

const v1 = '/api/v1';

if (apiV1BurstLimiter) {
  app.use(v1, apiV1BurstLimiter);
}

app.use(`${v1}/me`, requireAuth, profileRoutes);
app.use(`${v1}/promo-codes`, promoRoutes);
app.use(`${v1}/loans`, requireAuth, loansRoutes);
app.use(`${v1}/goals`, requireAuth, goalsRoutes);
app.use(`${v1}/goals/:goalId`, requireAuth, transactionRoutes);

app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    data: null,
    errors: [{ code: 'NOT_FOUND', message: `Route introuvable: ${req.method} ${req.path}` }],
  });
});

app.use(errorHandler);

export default app;
