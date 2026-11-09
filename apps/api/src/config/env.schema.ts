import { z } from 'zod';

const booleanStringSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://127.0.0.1:5173,http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL wajib diisi.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal harus 32 karakter.'),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .default(28800),
  AUTH_COOKIE_NAME: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z0-9_-]+$/, 'AUTH_COOKIE_NAME hanya boleh berisi huruf, angka, _ atau -.')
    .default('stas_access_token'),
  COOKIE_SECURE: booleanStringSchema,
});

export type ApiEnv = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown>): ApiEnv {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Konfigurasi environment @stas/api tidak valid: ${details}`);
  }
  return parsed.data;
}
