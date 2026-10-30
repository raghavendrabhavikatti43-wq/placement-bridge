import crypto from 'node:crypto';
import { z } from 'zod';

const ephemeralAccessSecret = crypto.randomBytes(32).toString('hex');
const ephemeralRefreshSecret = crypto.randomBytes(32).toString('hex');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().optional().default(''),
  DATABASE_URL: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('gemini-3.8-flash'),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(30),
  JWT_ACCESS_SECRET: z.string().optional().default(''),
  JWT_REFRESH_SECRET: z.string().optional().default(''),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGINS: z.string().optional().default(''),
  COOKIE_DOMAIN: z.string().optional().default(''),
  SEED_ADMIN_EMAIL: z.string().default('admin.tpo@nie-placement.edu'),
  SEED_ADMIN_PASSWORD: z.string().optional().default(''),
  SEED_STUDENT_PASSWORD: z.string().optional().default(''),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'firebase', 'supabase']).default('local'),
  STORAGE_BUCKET: z.string().optional().default(''),
  STORAGE_ENDPOINT: z.string().optional().default(''),
  STORAGE_ACCESS_KEY: z.string().optional().default(''),
  STORAGE_SECRET_KEY: z.string().optional().default(''),
  EMAIL_PROVIDER: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  CODE_EXEC_PROVIDER: z.string().optional().default(''),
  CODE_EXEC_URL: z.string().optional().default(''),
  CODE_EXEC_API_KEY: z.string().optional().default(''),
});

const parsed = envSchema.parse(process.env);

const resolveSecret = (provided: string, fallback: string): string => {
  const trimmed = provided.trim();
  if (
    trimmed.length >= 32 &&
    !trimmed.startsWith('change_me_') &&
    trimmed !== 'MY_JWT_SECRET'
  ) {
    return trimmed;
  }
  return fallback;
};

export const env = {
  ...parsed,
  JWT_ACCESS_SECRET: resolveSecret(parsed.JWT_ACCESS_SECRET, ephemeralAccessSecret),
  JWT_REFRESH_SECRET: resolveSecret(parsed.JWT_REFRESH_SECRET, ephemeralRefreshSecret),
  corsOriginsList: parsed.CORS_ORIGINS
    ? parsed.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [],
};

export function getCapabilityFlags() {
  const rawDb = (process.env.DATABASE_URL || '').trim();
  const databaseConfigured = Boolean(
    rawDb &&
      (rawDb.startsWith('postgresql://') || rawDb.startsWith('postgres://')) &&
      !rawDb.includes('USER:PASSWORD@ep-example')
  );
  const rawGemini = (process.env.GEMINI_API_KEY || '').trim();
  const aiEnabled = Boolean(rawGemini && rawGemini !== 'MY_GEMINI_API_KEY');
  const emailEnabled = Boolean(
    env.EMAIL_PROVIDER.trim() && (env.SMTP_HOST.trim() || env.EMAIL_FROM.trim())
  );
  const executionEnabled = Boolean(
    env.CODE_EXEC_PROVIDER.trim() && env.CODE_EXEC_URL.trim()
  );

  return {
    databaseConfigured,
    orm: 'prisma',
    aiEnabled,
    emailEnabled,
    executionEnabled,
    storageProvider: env.STORAGE_PROVIDER,
    storagePersistent: env.STORAGE_PROVIDER !== 'local',
  };
}
