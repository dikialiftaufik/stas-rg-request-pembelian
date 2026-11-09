import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ResearchType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { createResearchTypeSchema, updateResearchTypeSchema } from './dto/research-type.dto';
import { formatMoneyDecimal, ResearchTypesService } from './research-types.service';
import type { ResearchUsageMetrics } from './research-types.types';
import type { ResearchUsageProvider } from './research-usage.provider';

describe('ResearchTypesService & DTO Validation', () => {
  const baseDate = new Date('2026-11-04T06:00:00.000Z');
  let records = new Map<string, ResearchType>();
  let usageOverrides = new Map<string, Partial<ResearchUsageMetrics>>();
  let service: ResearchTypesService;

  const mockPrisma = {
    researchType: {
      findMany: vi.fn(() => Promise.resolve([...records.values()])),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(records.get(where.id) ?? null),
      ),
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: { name: { equals: string; mode: 'insensitive' }; id?: { not: string } };
        }) => {
          const target = where.name.equals.toLowerCase();
          for (const item of records.values()) {
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
            id: `rt-${String(records.size + 1)}`,
            name: data.name,
            description: data.description,
            allocated: data.allocated,
            createdAt: baseDate,
            updatedAt: baseDate,
          };
          records.set(created.id, created);
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
          const current = records.get(where.id);
          if (!current) {
            return Promise.reject(new Error('Record not found'));
          }
          const updated: ResearchType = {
            ...current,
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.allocated !== undefined ? { allocated: data.allocated } : {}),
            updatedAt: new Date('2026-11-04T07:00:00.000Z'),
          };
          records.set(where.id, updated);
          return Promise.resolve(updated);
        },
      ),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const current = records.get(where.id);
        records.delete(where.id);
        return Promise.resolve(current);
      }),
    },
  };

  function buildMetrics(id: string): ResearchUsageMetrics {
    const custom = usageOverrides.get(id);
    return {
      committed: custom?.committed ?? new Prisma.Decimal(0),
      requestCount: custom?.requestCount ?? 0,
      totalRequestsReferenced: custom?.totalRequestsReferenced ?? 0,
      rabDocumentCount: custom?.rabDocumentCount ?? 0,
      assignedUserCount: custom?.assignedUserCount ?? 0,
    };
  }

  const mockUsageProvider = {
    getUsageByResearchIds: vi.fn((ids: readonly string[]) => {
      const map = new Map<string, ResearchUsageMetrics>();
      for (const id of ids) {
        map.set(id, buildMetrics(id));
      }
      return Promise.resolve(map);
    }),
    getUsageForSingle: vi.fn((id: string) => Promise.resolve(buildMetrics(id))),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    records = new Map<string, ResearchType>([
      [
        'smart',
        {
          id: 'smart',
          name: 'Smart Mannequin',
          description: 'Proyek riset Smart Mannequin.',
          allocated: new Prisma.Decimal('75000000'),
          createdAt: baseDate,
          updatedAt: baseDate,
        },
      ],
      [
        'weather',
        {
          id: 'weather',
          name: 'Tel-U Weather Station',
          description: 'Pemantauan cuaca kampus.',
          allocated: new Prisma.Decimal('48000000'),
          createdAt: baseDate,
          updatedAt: baseDate,
        },
      ],
    ]);
    usageOverrides = new Map<string, Partial<ResearchUsageMetrics>>([
      [
        'smart',
        {
          committed: new Prisma.Decimal('25000000'),
          requestCount: 3,
          totalRequestsReferenced: 3,
        },
      ],
    ]);

    service = new ResearchTypesService(
      mockPrisma as unknown as PrismaService,
      mockUsageProvider as unknown as ResearchUsageProvider,
    );
  });

  it('formatMoneyDecimal memformat angka bulat dan desimal tanpa notasi ilmiah', () => {
    expect(formatMoneyDecimal(new Prisma.Decimal('75000000.00'))).toBe('75000000');
    expect(formatMoneyDecimal(new Prisma.Decimal('75000000.50'))).toBe('75000000.5');
    expect(formatMoneyDecimal(new Prisma.Decimal('75000000.25'))).toBe('75000000.25');
    expect(formatMoneyDecimal(new Prisma.Decimal('0'))).toBe('0');
  });

  it('findAll mengembalikan daftar terfilter q namun tetap menjaga total summary keseluruhan', async () => {
    const result = await service.findAll({ q: 'cuaca' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('weather');
    expect(result.meta).toEqual({
      total: 1,
      summary: {
        totalAllocated: '123000000',
        totalCommitted: '25000000',
        totalRemaining: '98000000',
      },
    });
  });

  it('findOne mengembalikan detail lengkap atau melempar NotFoundException jika tidak ada', async () => {
    const item = await service.findOne('smart');
    expect(item).toMatchObject({
      id: 'smart',
      name: 'Smart Mannequin',
      allocated: '75000000',
      committed: '25000000',
      remaining: '50000000',
      requestCount: 3,
    });

    await expect(service.findOne('tidak-ada')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create berhasil menambah riset baru dan menolak duplikasi nama tanpa peduli huruf besar/kecil', async () => {
    const created = await service.create({
      name: 'Modern Farming',
      description: 'Pertanian presisi.',
      allocated: '60000000',
    });

    expect(created).toMatchObject({
      name: 'Modern Farming',
      description: 'Pertanian presisi.',
      allocated: '60000000',
      committed: '0',
      remaining: '60000000',
    });

    await expect(
      service.create({
        name: 'smart mannequin',
        description: 'Duplikat',
        allocated: '10000000',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('update menolak alokasi yang lebih kecil daripada dana berkomitmen', async () => {
    await expect(
      service.update('smart', {
        allocated: '20000000',
      }),
    ).rejects.toThrow(
      new BadRequestException('Alokasi tidak boleh lebih kecil daripada dana yang digunakan.'),
    );

    const updated = await service.update('smart', {
      allocated: '30000000',
    });
    expect(updated.allocated).toBe('30000000');
    expect(updated.remaining).toBe('5000000');
  });

  it('remove menolak penghapusan riset yang masih dirujuk RAB, request, atau pengguna', async () => {
    // smart sudah memiliki totalRequestsReferenced = 3
    await expect(service.remove('smart')).rejects.toThrow(
      'Jenis riset masih dirujuk oleh request dan tidak dapat dihapus.',
    );

    usageOverrides.set('weather', { rabDocumentCount: 1 });
    await expect(service.remove('weather')).rejects.toThrow(
      'Riset masih memiliki dokumen RAB dan tidak dapat dihapus.',
    );

    usageOverrides.set('weather', { assignedUserCount: 2 });
    await expect(service.remove('weather')).rejects.toThrow(
      'Jenis riset masih memiliki perwakilan pengguna.',
    );

    usageOverrides.delete('weather');
    const deleted = await service.remove('weather');
    expect(deleted).toEqual({ id: 'weather', deleted: true });
  });

  it('skema DTO memvalidasi nominal uang, nama kosong, dan payload update kosong', () => {
    expect(
      createResearchTypeSchema.safeParse({
        name: '   ',
        allocated: '50000000',
      }).success,
    ).toBe(false);

    expect(
      createResearchTypeSchema.safeParse({
        name: 'Riset Uji',
        allocated: '0',
      }).success,
    ).toBe(false);

    expect(
      createResearchTypeSchema.safeParse({
        name: 'Riset Uji',
        allocated: '10000.999',
      }).success,
    ).toBe(false);

    expect(updateResearchTypeSchema.safeParse({}).success).toBe(false);
  });
});
