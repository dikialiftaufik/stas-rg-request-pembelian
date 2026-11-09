import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { ResearchType, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../bootstrap';
import { validateEnv } from '../../config/env.schema';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ResearchTypesModule } from './research-types.module';

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

describe('ResearchTypes HTTP Endpoints (/api/v1/research-types)', () => {
  let app: INestApplication<App>;
  let adminPasswordHash: string;
  const createdAt = new Date('2026-11-04T06:00:00.000Z');

  let usersById = new Map<string, User>();
  let researchById = new Map<string, ResearchType>();
  let assignedUserCountByResearch = new Map<string, number>();

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
        const updated: User = { ...existing, ...data, updatedAt: new Date() };
        usersById.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    researchType: {
      findMany: vi.fn(() => Promise.resolve([...researchById.values()])),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(researchById.get(where.id) ?? null),
      ),
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: { name: { equals: string; mode: 'insensitive' }; id?: { not: string } };
        }) => {
          const target = where.name.equals.toLowerCase();
          for (const item of researchById.values()) {
            if (where.id?.not && item.id === where.id.not) {
              continue;
            }
            if (item.name.toLowerCase() === target) {
              return Promise.resolve({ id: item.id });
            }
          }
          return Promise.resolve(null);
        },
      ),
      create: vi.fn(
        ({ data }: { data: { name: string; description: string; allocated: Prisma.Decimal } }) => {
          const created: ResearchType = {
            id: `research-${String(researchById.size + 1)}`,
            name: data.name,
            description: data.description,
            allocated: data.allocated,
            createdAt,
            updatedAt: createdAt,
          };
          researchById.set(created.id, created);
          return Promise.resolve(created);
        },
      ),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { name?: string; description?: string; allocated?: Prisma.Decimal };
        }) => {
          const existing = researchById.get(where.id);
          if (!existing) {
            return Promise.reject(new Error('Not found'));
          }
          const updated: ResearchType = {
            ...existing,
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.allocated !== undefined ? { allocated: data.allocated } : {}),
            updatedAt: createdAt,
          };
          researchById.set(where.id, updated);
          return Promise.resolve(updated);
        },
      ),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const existing = researchById.get(where.id);
        researchById.delete(where.id);
        return Promise.resolve(existing);
      }),
    },
    userResearchAssignment: {
      groupBy: vi.fn(({ where }: { where: { researchId: { in: string[] } } }) => {
        const groups: Array<{ researchId: string; _count: { userId: number } }> = [];
        for (const id of where.researchId.in) {
          const count = assignedUserCountByResearch.get(id) ?? 0;
          if (count > 0) {
            groups.push({ researchId: id, _count: { userId: count } });
          }
        }
        return Promise.resolve(groups);
      }),
    },
  };

  async function loginAsAdmin(): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@gmail.com', password: 'admin123' })
      .expect(200);
    return extractSetCookies(res.headers);
  }

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
        ResearchTypesModule,
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

    researchById = new Map<string, ResearchType>([
      [
        'smart',
        {
          id: 'smart',
          name: 'Smart Mannequin',
          description: 'Proyek riset Smart Mannequin.',
          allocated: new Prisma.Decimal('75000000'),
          createdAt,
          updatedAt: createdAt,
        },
      ],
    ]);

    assignedUserCountByResearch = new Map<string, number>();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('menolak akses CRUD tanpa cookie login Admin (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/research-types').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/research-types')
      .send({ name: 'Baru', allocated: '10000000' })
      .expect(401);
  });

  it('Admin dapat membuat, membaca daftar/detail, mengubah, dan menghapus Jenis Riset', async () => {
    const cookies = await loginAsAdmin();

    // 1. Create (POST)
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/research-types')
      .set('Cookie', cookies)
      .send({
        name: '  ML Deteksi Malware ',
        description: '  Riset keamanan siber. ',
        allocated: '55000000',
      })
      .expect(201);

    const createdId = (createRes.body as { data: { id: string } }).data.id;
    expect(createRes.body).toEqual({
      data: {
        id: createdId,
        name: 'ML Deteksi Malware',
        description: 'Riset keamanan siber.',
        allocated: '55000000',
        committed: '0',
        remaining: '55000000',
        requestCount: 0,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      },
    });

    // 2. List + Search (GET)
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/research-types?q=malware')
      .set('Cookie', cookies)
      .expect(200);

    expect(listRes.body).toMatchObject({
      meta: {
        total: 1,
        summary: {
          totalAllocated: '130000000',
          totalCommitted: '0',
          totalRemaining: '130000000',
        },
      },
    });

    // 3. Get Detail (GET :id)
    await request(app.getHttpServer())
      .get(`/api/v1/research-types/${createdId}`)
      .set('Cookie', cookies)
      .expect(200);

    // 4. Update (PATCH :id)
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/research-types/${createdId}`)
      .set('Cookie', cookies)
      .send({
        allocated: '60000000',
      })
      .expect(200);

    expect(patchRes.body).toMatchObject({
      data: {
        id: createdId,
        allocated: '60000000',
        remaining: '60000000',
      },
    });

    // 5. Delete ditolak jika masih memiliki perwakilan pengguna (409)
    assignedUserCountByResearch.set(createdId, 1);
    const conflictDeleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/research-types/${createdId}`)
      .set('Cookie', cookies)
      .expect(409);

    expect(conflictDeleteRes.body).toMatchObject({
      statusCode: 409,
      message: 'Jenis riset masih memiliki perwakilan pengguna.',
    });

    // 6. Delete berhasil ketika tidak ada referensi (200)
    assignedUserCountByResearch.delete(createdId);
    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/research-types/${createdId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(deleteRes.body).toEqual({
      data: {
        id: createdId,
        deleted: true,
      },
    });

    // 7. Get setelah dihapus mengembalikan 404
    await request(app.getHttpServer())
      .get(`/api/v1/research-types/${createdId}`)
      .set('Cookie', cookies)
      .expect(404);
  });
});
