import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { createUserSchema, updateUserSchema } from './dto/user.dto';
import { UsersService } from './users.service';

interface FakeUser {
  id: string;
  name: string;
  identifier: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'pengaju';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const baseDate = new Date('2026-11-05T07:00:00.000Z');

describe('UsersService & DTO', () => {
  let users: Map<string, FakeUser>;
  let assignments: { userId: string; researchId: string }[];
  const researchIds = new Set(['rt-1', 'rt-2']);
  let service: UsersService;

  const withAssignments = (user: FakeUser) => ({
    ...user,
    researchAssignments: assignments
      .filter((item) => item.userId === user.id)
      .map((item) => ({ researchId: item.researchId })),
  });

  const matches = (user: FakeUser, where: Record<string, unknown>): boolean => {
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
    findMany: vi.fn(() => Promise.resolve([...users.values()].map(withAssignments))),
    findUnique: vi.fn(({ where }: { where: { id: string } }) => {
      const user = users.get(where.id);
      return Promise.resolve(user ? withAssignments(user) : null);
    }),
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const found = [...users.values()].find((user) => matches(user, where));
      return Promise.resolve(found ? { id: found.id } : null);
    }),
    count: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve([...users.values()].filter((user) => matches(user, where)).length),
    ),
    create: vi.fn(
      ({
        data,
      }: {
        data: Omit<FakeUser, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> & {
          researchAssignments: { create: { researchId: string }[] };
        };
      }) => {
        const { researchAssignments, ...rest } = data;
        const created: FakeUser = {
          ...rest,
          id: `u-${String(users.size + 1)}`,
          lastLoginAt: null,
          createdAt: baseDate,
          updatedAt: baseDate,
        };
        users.set(created.id, created);
        for (const item of researchAssignments.create) {
          assignments.push({ userId: created.id, researchId: item.researchId });
        }
        return Promise.resolve(withAssignments(created));
      },
    ),
    update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
      const current = users.get(where.id);
      if (!current) return Promise.reject(new Error('not found'));
      const updated = { ...current, ...data };
      users.set(where.id, updated);
      return Promise.resolve(withAssignments(updated));
    }),
    delete: vi.fn(({ where }: { where: { id: string } }) => {
      users.delete(where.id);
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
        Promise.resolve(where.id.in.filter((id) => researchIds.has(id)).length),
      ),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({ user: userDelegate, userResearchAssignment: assignmentDelegate }),
    ),
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    name: 'Administrator',
    identifier: 'admin',
    email: 'admin@gmail.com',
    role: 'admin',
    createdAt: baseDate.toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    users = new Map([
      [
        admin.id,
        {
          id: admin.id,
          name: admin.name,
          identifier: admin.identifier,
          email: admin.email,
          passwordHash: 'hash',
          role: 'admin',
          isActive: true,
          lastLoginAt: null,
          createdAt: baseDate,
          updatedAt: baseDate,
        },
      ],
    ]);
    assignments = [];
    service = new UsersService(mockPrisma as unknown as PrismaService);
  });

  const pengajuInput = () =>
    createUserSchema.parse({
      name: 'Budi',
      identifier: '2101',
      email: 'Budi@Example.com',
      role: 'pengaju',
      password: 'rahasia123',
      researchIds: ['rt-1'],
    });

  it('membuat akun Pengaju dengan password ter-hash dan tanpa membocorkan hash', async () => {
    const created = await service.create(pengajuInput());
    expect(created).toMatchObject({
      email: 'budi@example.com',
      role: 'pengaju',
      isActive: true,
      researchIds: ['rt-1'],
    });
    expect(created).not.toHaveProperty('passwordHash');
    const stored = users.get(created.id);
    expect(stored && (await bcrypt.compare('rahasia123', stored.passwordHash))).toBe(true);
  });

  it('menolak email/NIP duplikat dan riset yang tidak valid', async () => {
    await service.create(pengajuInput());
    await expect(service.create(pengajuInput())).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.create({ ...pengajuInput(), email: 'x@a.com', identifier: '9', researchIds: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...pengajuInput(), email: 'y@a.com', identifier: '8', researchIds: ['x'] }),
    ).rejects.toThrow(/riset tidak ditemukan/);
  });

  it('mengosongkan perwakilan riset ketika peran Admin', async () => {
    const created = await service.create({
      ...pengajuInput(),
      role: 'admin',
      researchIds: ['rt-1'],
    });
    expect(created.researchIds).toEqual([]);
  });

  it('memperbarui data, password, dan riset', async () => {
    const created = await service.create(pengajuInput());
    const updated = await service.update(
      created.id,
      updateUserSchema.parse({ name: 'Budi S', password: 'baru12345', researchIds: ['rt-2'] }),
      admin,
    );
    expect(updated).toMatchObject({ name: 'Budi S', researchIds: ['rt-2'] });
    const stored = users.get(created.id);
    expect(stored && (await bcrypt.compare('baru12345', stored.passwordHash))).toBe(true);
  });

  it('melindungi akun sendiri dan Admin aktif terakhir', async () => {
    await expect(service.update(admin.id, { isActive: false }, admin)).rejects.toThrow(
      /menonaktifkan akun Anda sendiri/,
    );
    await expect(
      service.update(admin.id, { role: 'pengaju', researchIds: ['rt-1'] }, admin),
    ).rejects.toThrow(/menurunkan peran/);
    await expect(service.remove(admin.id, admin)).rejects.toThrow(/menghapus akun Anda sendiri/);

    const otherAdmin = await service.create({
      ...pengajuInput(),
      role: 'admin',
      email: 'admin2@a.com',
      identifier: 'adm2',
    });
    const actor2: AuthenticatedUser = { ...admin, id: otherAdmin.id };
    users.set(admin.id, { ...users.get(admin.id)!, isActive: false });
    await expect(service.remove(otherAdmin.id, admin)).rejects.toThrow(/Admin aktif/);
    await expect(service.update(otherAdmin.id, { isActive: false }, actor2)).rejects.toThrow();
  });

  it('menghapus pengguna dan melaporkan pengguna yang tidak ada', async () => {
    const created = await service.create(pengajuInput());
    await expect(service.remove(created.id, admin)).resolves.toEqual({
      id: created.id,
      deleted: true,
    });
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('memfilter daftar berdasarkan kata kunci dan peran', async () => {
    await service.create(pengajuInput());
    const result = await service.findAll({ q: 'budi', role: undefined });
    expect(result.meta.total).toBe(1);
    expect(result.meta.summary).toEqual({ totalAdmins: 1, totalPengaju: 1, totalInactive: 0 });
    expect((await service.findAll({ q: '', role: 'admin' })).data).toHaveLength(1);
  });

  it('memvalidasi DTO', () => {
    expect(createUserSchema.safeParse({ ...pengajuInput(), password: 'pendek' }).success).toBe(
      false,
    );
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ passwordHash: 'x' }).success).toBe(false);
  });
});
