import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  const validBase = {
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/stas_db?schema=public',
    JWT_SECRET: 'test-jwt-secret-key-minimum-32-characters-long',
  };

  it('memvalidasi konfigurasi minimal dan memberi nilai default yang aman', () => {
    const env = validateEnv(validBase);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.AUTH_COOKIE_NAME).toBe('stas_access_token');
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(28800);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://127.0.0.1:5173', 'http://localhost:5173']);
  });

  it('menolak JWT_SECRET yang kurang dari 32 karakter', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        JWT_SECRET: 'terlalu-pendek',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('menolak DATABASE_URL kosong', () => {
    expect(() =>
      validateEnv({
        ...validBase,
        DATABASE_URL: '   ',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
