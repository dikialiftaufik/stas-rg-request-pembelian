import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../bootstrap';
import { validateEnv } from '../../config/env.schema';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthModule } from '../health/health.module';
import { AuthModule } from './auth.module';

function extractSetCookies(headers: Record<string, unknown>): string[] {
  const raw = headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    return [raw];
  }
  return [];
}

describe('Admin Auth HTTP Endpoints (/api/v1/auth/admin)', () => {
  let app: INestApplication<App>;
  let adminPasswordHash: string;
  let pengajuPasswordHash: string;

  const createdAt = new Date('2026-10-30T08:00:00.000Z');
  let usersById = new Map<string, User>();

  const mockPrisma = {
    user: {
      findUnique: vi.fn(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) {
          return Promise.resolve(usersById.get(where.id) ?? null);
        }
        if (where.email) {
          for (const candidate of usersById.values()) {
            if (candidate.email === where.email) {
              return Promise.resolve(candidate);
            }
          }
        }
        return Promise.resolve(null);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        const existing = usersById.get(where.id);
        if (!existing) {
          return Promise.reject(new Error('User not found'));
        }
        const updated: User = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        usersById.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
  };

  beforeAll(async () => {
    adminPasswordHash = await bcrypt.hash('admin123', 10);
    pengajuPasswordHash = await bcrypt.hash('pengaju123', 10);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () =>
              validateEnv({
                NODE_ENV: 'test',
                PORT: '3000',
                CORS_ORIGINS: 'http://127.0.0.1:5173',
                DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/stas_test',
                JWT_SECRET: 'test-only-jwt-secret-key-minimum-32-characters',
                JWT_EXPIRES_IN_SECONDS: '3600',
                AUTH_COOKIE_NAME: 'stas_access_token',
                COOKIE_SECURE: 'false',
              }),
          ],
        }),
        PrismaModule,
        HealthModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    usersById = new Map<string, User>([
      [
        'user-admin-1',
        {
          id: 'user-admin-1',
          name: 'Administrator',
          identifier: 'admin',
          email: 'admin@gmail.com',
          passwordHash: adminPasswordHash,
          role: 'admin',
          isActive: true,
          lastLoginAt: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      [
        'user-admin-inactive',
        {
          id: 'user-admin-inactive',
          name: 'Admin Nonaktif',
          identifier: 'admin-inactive',
          email: 'nonaktif@gmail.com',
          passwordHash: adminPasswordHash,
          role: 'admin',
          isActive: false,
          lastLoginAt: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      [
        'user-pengaju-1',
        {
          id: 'user-pengaju-1',
          name: 'Ir. Citra Dewi',
          identifier: '19880412001',
          email: 'pengaju@gmail.com',
          passwordHash: pengajuPasswordHash,
          role: 'pengaju',
          isActive: true,
          lastLoginAt: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    ]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/health mengembalikan status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual({
      data: {
        status: 'ok',
        service: '@stas/api',
      },
    });
  });

  it('POST /api/v1/auth/admin/login berhasil untuk Admin valid, menormalisasi email, dan mengatur HttpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: '  ADMIN@Gmail.com ',
        password: 'admin123',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        user: {
          id: 'user-admin-1',
          name: 'Administrator',
          identifier: 'admin',
          email: 'admin@gmail.com',
          role: 'admin',
          createdAt: createdAt.toISOString(),
        },
      },
    });

    const cookies = extractSetCookies(response.headers);

    expect(cookies.some((cookie) => cookie.startsWith('stas_access_token='))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('SameSite=Lax'))).toBe(true);
    expect(usersById.get('user-admin-1')?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('POST /api/v1/auth/admin/login menolak password salah dengan 401 dan pesan generik', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@gmail.com',
        password: 'password-salah',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Email atau password salah.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('POST /api/v1/auth/admin/login menolak email tidak terdaftar dengan 401 dan pesan generik', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'tidakada@gmail.com',
        password: 'admin123',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Email atau password salah.',
    });
  });

  it('POST /api/v1/auth/admin/login menolak akun Admin yang nonaktif dengan 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'nonaktif@gmail.com',
        password: 'admin123',
      })
      .expect(401);
  });

  it('POST /api/v1/auth/admin/login menolak akun Pengaju dengan 403 Forbidden', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'pengaju@gmail.com',
        password: 'pengaju123',
      })
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Akses ditolak. Akun ini bukan Admin.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('POST /api/v1/auth/admin/login menolak format email tidak valid atau field asing dengan 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'bukan-email',
        password: 'admin123',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@gmail.com',
        password: 'admin123',
        unexpectedField: true,
      })
      .expect(400);
  });

  it('GET /api/v1/auth/admin/me mengembalikan profil Admin saat membawa HttpOnly cookie yang valid', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@gmail.com',
        password: 'admin123',
      })
      .expect(200);

    const cookieHeader = extractSetCookies(loginResponse.headers);

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/admin/me')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(meResponse.body).toEqual({
      data: {
        user: {
          id: 'user-admin-1',
          name: 'Administrator',
          identifier: 'admin',
          email: 'admin@gmail.com',
          role: 'admin',
          createdAt: createdAt.toISOString(),
        },
      },
    });
  });

  it('GET /api/v1/auth/admin/me menolak akses tanpa cookie atau dengan token palsu (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/admin/me').expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/admin/me')
      .set('Cookie', ['stas_access_token=token.palsu.tidakvalid'])
      .expect(401);
  });

  it('GET /api/v1/auth/admin/me menolak akses jika peran akun di database bukan lagi admin (403)', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@gmail.com',
        password: 'admin123',
      })
      .expect(200);

    const adminRecord = usersById.get('user-admin-1');
    if (adminRecord) {
      usersById.set('user-admin-1', { ...adminRecord, role: 'pengaju' });
    }

    const cookieHeader = extractSetCookies(loginResponse.headers);

    await request(app.getHttpServer())
      .get('/api/v1/auth/admin/me')
      .set('Cookie', cookieHeader)
      .expect(403);
  });

  it('POST /api/v1/auth/admin/logout menghapus cookie sesi Admin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/logout')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        loggedOut: true,
      },
    });

    const cookies = extractSetCookies(response.headers);

    expect(cookies.some((cookie) => cookie.startsWith('stas_access_token=;'))).toBe(true);
  });
});
