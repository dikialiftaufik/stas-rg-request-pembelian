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
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from './users.module';

function extractSetCookies(headers: Record<string, unknown>): string[] {
  const raw = headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  return typeof raw === 'string' ? [raw] : [];
}

describe('Users HTTP Endpoints (/api/v1/users)', () => {
  let app: INestApplication<App>;
  let adminPasswordHash: string;
  const createdAt = new Date('2026-11-05T07:00:00.000Z');
  let usersById = new Map<string, User>();
  let assignments: { userId: string; researchId: string }[] = [];
  const validResearchIds = new Set(['rt-1', 'rt-2']);

  const withAssignments = (user: User) => ({
    ...user,
    researchAssignments: assignments
      .filter((item) => item.userId === user.id)
      .map((item) => ({ researchId: item.researchId })),
  });

  const matches = (user: User, where: Record<string, unknown>): boolean => {
    if (where.role !== undefined && user.role !== where.role) return false;
    if (where.isActive !== undefined && user.isActive !== where.isActive) return false;
    const idFilter = where.id as { not?: string } | undefined;
    if (idFilter?.not && user.id === idFilter.not) return false;
    const or = where.OR as
      | { email?: { equals: string }; identifier?: { equals: string } }[]
      | undefined;
    if (or) {
      return or.some(
        (cond) =>
          (cond.email && user.email.toLowerCase() === cond.email.equals.toLowerCase()) ||
          (cond.identifier &&
            user.identifier.toLowerCase() === cond.identifier.equals.toLowerCase()),
      );
    }
    return true;
  };

  const userDelegate = {
    findMany: vi.fn(() => Promise.resolve([...usersById.values()].map(withAssignments))),
    findUnique: vi.fn(({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) {
        const found = usersById.get(where.id);
        return Promise.resolve(found ? withAssignments(found) : null);
      }
      if (where.email) {
        for (const candidate of usersById.values()) {
          if (candidate.email === where.email) {
            return Promise.resolve(withAssignments(candidate));
          }
        }
      }
      return Promise.resolve(null);
    }),
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const found = [...usersById.values()].find((user) => matches(user, where));
      return Promise.resolve(found ? { id: found.id } : null);
    }),
    count: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve([...usersById.values()].filter((user) => matches(user, where)).length),
    ),
    create: vi.fn(
      ({
        data,
      }: {
        data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> & {
          researchAssignments: { create: { researchId: string }[] };
        };
      }) => {
        const { researchAssignments, ...rest } = data;
        const created: User = {
          ...rest,
          id: `user-${String(usersById.size + 1)}`,
          lastLoginAt: null,
          createdAt,
          updatedAt: createdAt,
        };
        usersById.set(created.id, created);
        for (const item of researchAssignments.create) {
          assignments.push({ userId: created.id, researchId: item.researchId });
        }
        return Promise.resolve(withAssignments(created));
      },
    ),
    update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<User> }) => {
      const existing = usersById.get(where.id);
      if (!existing) return Promise.reject(new Error('User not found'));
      const updated: User = { ...existing, ...data, updatedAt: new Date() };
      usersById.set(where.id, updated);
      return Promise.resolve(withAssignments(updated));
    }),
    delete: vi.fn(({ where }: { where: { id: string } }) => {
      usersById.delete(where.id);
      assignments = assignments.filter((item) => item.userId !== where.id);
      return Promise.resolve({});
    }),
  };

  const assignmentDelegate = {
    deleteMany: vi.fn(({ where }: { where: { userId: string } }) => {
      assignments = assignments.filter((item) => item.userId !== where.userId);
      return Promise.resolve({ count: 0 });
    }),
    createMany: vi.fn(({ data }: { data: { userId: string; researchId: string }[] }) => {
      assignments.push(...data);
      return Promise.resolve({ count: data.length });
    }),
  };

  const mockPrisma = {
    user: userDelegate,
    userResearchAssignment: assignmentDelegate,
    researchType: {
      count: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.filter((id) => validResearchIds.has(id)).length),
      ),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({ user: userDelegate, userResearchAssignment: assignmentDelegate }),
    ),
  };

  beforeAll(async () => {
    adminPasswordHash = await bcrypt.hash('admin123', 10);

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
        AuthModule,
        UsersModule,
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
    assignments = [];
    usersById = new Map([
      [
        'admin-1',
        {
          id: 'admin-1',
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
    ]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function loginAsAdmin(): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@gmail.com', password: 'admin123' })
      .expect(200);
    return extractSetCookies(res.headers);
  }

  it('menolak akses tanpa autentikasi Admin (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('menjalankan siklus penuh CRUD akun Admin -> Pengaju di endpoint /api/v1/users', async () => {
    const cookies = await loginAsAdmin();

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', cookies)
      .send({
        name: 'Siti Rahma',
        identifier: '19910203001',
        email: 'Siti@Kampus.ac.id',
        role: 'pengaju',
        password: 'password123',
        researchIds: ['rt-1'],
      })
      .expect(201);

    const createdId = (createRes.body as { data: { id: string } }).data.id;
    expect(createRes.body).toMatchObject({
      data: {
        name: 'Siti Rahma',
        identifier: '19910203001',
        email: 'siti@kampus.ac.id',
        role: 'pengaju',
        isActive: true,
        researchIds: ['rt-1'],
      },
    });
    expect((createRes.body as { data: Record<string, unknown> }).data).not.toHaveProperty(
      'passwordHash',
    );

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Cookie', cookies)
      .expect(200);
    expect((listRes.body as { meta: { total: number } }).meta.total).toBe(2);

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/users/${createdId}`)
      .set('Cookie', cookies)
      .send({
        name: 'Siti Rahma, M.T.',
        isActive: false,
        researchIds: ['rt-2'],
      })
      .expect(200);
    expect(patchRes.body).toMatchObject({
      data: {
        id: createdId,
        name: 'Siti Rahma, M.T.',
        isActive: false,
        researchIds: ['rt-2'],
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${createdId}`)
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${createdId}`)
      .set('Cookie', cookies)
      .expect(404);
  });
});
