import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ResearchType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateResearchTypeDto,
  ListResearchTypesQueryDto,
  UpdateResearchTypeDto,
} from './dto/research-type.dto';
import type {
  ResearchTypeItem,
  ResearchTypeListResponse,
  ResearchUsageMetrics,
} from './research-types.types';
import { ResearchUsageProvider } from './research-usage.provider';

const ZERO_DECIMAL = new Prisma.Decimal(0);

export function formatMoneyDecimal(value: Prisma.Decimal): string {
  const fixed = value.toDecimalPlaces(2).toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isPrismaForeignKeyError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

@Injectable()
export class ResearchTypesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ResearchUsageProvider) private readonly usageProvider: ResearchUsageProvider,
  ) {}

  async findAll(query: ListResearchTypesQueryDto): Promise<ResearchTypeListResponse> {
    const allRecords = await this.prisma.researchType.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const usageMap = await this.usageProvider.getUsageByResearchIds(
      allRecords.map((record) => record.id),
    );

    let totalAllocated = ZERO_DECIMAL;
    let totalCommitted = ZERO_DECIMAL;

    for (const record of allRecords) {
      const usage = usageMap.get(record.id);
      totalAllocated = totalAllocated.plus(record.allocated);
      totalCommitted = totalCommitted.plus(usage?.committed ?? ZERO_DECIMAL);
    }

    const keyword = query.q.trim().toLocaleLowerCase('id');
    const filteredRecords = keyword
      ? allRecords.filter((record) =>
          `${record.name} ${record.description}`.toLocaleLowerCase('id').includes(keyword),
        )
      : allRecords;

    const items = filteredRecords.map((record) =>
      this.toResearchTypeItem(record, usageMap.get(record.id)),
    );

    return {
      data: items,
      meta: {
        total: items.length,
        summary: {
          totalAllocated: formatMoneyDecimal(totalAllocated),
          totalCommitted: formatMoneyDecimal(totalCommitted),
          totalRemaining: formatMoneyDecimal(totalAllocated.minus(totalCommitted)),
        },
      },
    };
  }

  async findOne(id: string): Promise<ResearchTypeItem> {
    const record = await this.prisma.researchType.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Jenis riset tidak ditemukan.');
    }

    const usage = await this.usageProvider.getUsageForSingle(record.id);
    return this.toResearchTypeItem(record, usage);
  }

  async create(dto: CreateResearchTypeDto): Promise<ResearchTypeItem> {
    await this.ensureUniqueName(dto.name);

    try {
      const created = await this.prisma.researchType.create({
        data: {
          name: dto.name,
          description: dto.description,
          allocated: new Prisma.Decimal(dto.allocated),
        },
      });

      return this.toResearchTypeItem(created);
    } catch (error: unknown) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Nama jenis riset sudah digunakan.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateResearchTypeDto): Promise<ResearchTypeItem> {
    const existing = await this.prisma.researchType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Jenis riset tidak ditemukan.');
    }

    if (dto.name !== undefined) {
      await this.ensureUniqueName(dto.name, id);
    }

    const usage = await this.usageProvider.getUsageForSingle(id);
    const nextAllocated =
      dto.allocated !== undefined ? new Prisma.Decimal(dto.allocated) : existing.allocated;

    if (nextAllocated.lt(usage.committed)) {
      throw new BadRequestException(
        'Alokasi tidak boleh lebih kecil daripada dana yang digunakan.',
      );
    }

    try {
      const updated = await this.prisma.researchType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.allocated !== undefined ? { allocated: nextAllocated } : {}),
        },
      });

      return this.toResearchTypeItem(updated, usage);
    } catch (error: unknown) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Nama jenis riset sudah digunakan.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.prisma.researchType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Jenis riset tidak ditemukan.');
    }

    const usage = await this.usageProvider.getUsageForSingle(id);

    if (usage.rabDocumentCount > 0) {
      throw new ConflictException('Riset masih memiliki dokumen RAB dan tidak dapat dihapus.');
    }
    if (usage.totalRequestsReferenced > 0) {
      throw new ConflictException(
        'Jenis riset masih dirujuk oleh request dan tidak dapat dihapus.',
      );
    }
    if (usage.assignedUserCount > 0) {
      throw new ConflictException('Jenis riset masih memiliki perwakilan pengguna.');
    }

    try {
      await this.prisma.researchType.delete({
        where: { id },
      });

      return { id, deleted: true };
    } catch (error: unknown) {
      if (isPrismaForeignKeyError(error)) {
        throw new ConflictException(
          'Jenis riset masih dirujuk oleh data lain dan tidak dapat dihapus.',
        );
      }
      throw error;
    }
  }

  private async ensureUniqueName(name: string, excludeId?: string): Promise<void> {
    const duplicate = await this.prisma.researchType.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Nama jenis riset sudah digunakan.');
    }
  }

  private toResearchTypeItem(record: ResearchType, usage?: ResearchUsageMetrics): ResearchTypeItem {
    const committed = usage?.committed ?? ZERO_DECIMAL;
    const remaining = record.allocated.minus(committed);

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      allocated: formatMoneyDecimal(record.allocated),
      committed: formatMoneyDecimal(committed),
      remaining: formatMoneyDecimal(remaining),
      requestCount: usage?.requestCount ?? 0,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
