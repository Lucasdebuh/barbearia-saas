import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter no mínimo 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(30),

  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().optional(),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_API_URL: z.string().default('https://api.mercadopago.com'),

  PIX_EXPIRATION_MINUTES: z.coerce.number().default(30),
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().default(5),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),

  ADMIN_EMAIL: z.string().email().default('admin@barbearia.com'),
  ADMIN_PASSWORD: z.string().default('Admin@12345'),

  LOG_LEVEL: z.string().default('info'),
  SWAGGER_ENABLED: bool(true),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Variáveis de ambiente inválidas:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Configuração inválida. Verifique o arquivo .env (use .env.example como base).');
}

const raw = parsed.data;

export const env = {
  ...raw,
  JWT_REFRESH_SECRET: raw.JWT_REFRESH_SECRET ?? `${raw.JWT_SECRET}:refresh`,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  /** Mercado Pago só é considerado ativo quando existe um access token real. */
  mercadoPagoEnabled: Boolean(raw.MERCADOPAGO_ACCESS_TOKEN && raw.MERCADOPAGO_ACCESS_TOKEN.length > 10),
  corsOrigins: (raw.CORS_ORIGINS ?? raw.FRONTEND_URL)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export type Env = typeof env;
