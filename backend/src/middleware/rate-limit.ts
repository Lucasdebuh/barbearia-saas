import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const message = {
  error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições. Tente novamente em instantes.' },
};

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  skip: () => env.isTest,
});

/** Limite agressivo para login/registro/reset — mitiga força bruta e enumeração de contas. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
});

/** Limite específico para criação de pagamentos/agendamentos. */
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  skip: () => env.isTest,
});
