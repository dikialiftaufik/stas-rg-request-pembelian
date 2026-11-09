import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/user.dto';
import type { UserAccountItem, UserAccountListResponse } from './users.types';

const BCRYPT_ROUNDS = 12;

const userWithAssignments = {
  researchAssignments: {
    select: { researchId: true },
    orderBy: { assignedAt: 'asc' },
  },
} satisfies Prisma.UserInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userWithAssignments }>;

function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isPrismaForeignKeyError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

export function toUserAccountItem(record: UserRecord): UserAccountItem {
  return {
    id: record.id,
    name: record.name,
    identifier: record.identifier,
    email: record.email,
    role: record.role,
    isActive: record.isActive,
    researchIds: record.researchAssignments.map((assignment) => assignment.researchId),
    lastLoginAt: record.lastLoginAt ? record.lastLoginAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(query: ListUsersQueryDto): Promise<UserAccountListResponse> {
    const allRecords = await this.prisma.user.findMany({
      include: userWithAssignments,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const keyword = query.q.trim().toLocaleLowerCase('id');
    const filtered = allRecords.filter((record) => {
      if (query.role && record.role !== query.role) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return `${record.name} ${record.identifier} ${record.email}`
        .toLocaleLowerCase('id')
        .includes(keyword);
    });

    return {
      data: filtered.map(toUserAccountItem),
      meta: {
        total: filtered.length,
        summary: {
          totalAdmins: allRecords.filter((record) => record.role === 'admin').length,
          totalPengaju: allRecords.filter((record) => record.role === 'pengaju').length,
          totalInactive: allRecords.filter((record) => !record.isActive).length,
        },
      },
    };
  }

  async findOne(id: string): Promise<UserAccountItem> {
    return toUserAccountItem(await this.getExisting(id));
  }

  async create(dto: CreateUserDto): Promise<UserAccountItem> {
    const researchIds = this.normalizeResearchIds(dto.role, dto.researchIds);
    await this.ensureUniqueCredentials(dto.email, dto.identifier);
    await this.ensureResearchExists(researchIds);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const created = await this.prisma.user.create({
        data: {
          name: dto.name,
          identifier: dto.identifier,
          email: dto.email,
          passwordHash,
          role: dto.role,
          isActive: dto.isActive,
          researchAssignments: {
            create: researchIds.map((researchId) => ({ researchId })),
          },
        },
        include: userWithAssignments,
      });
      return toUserAccountItem(created);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<UserAccountItem> {
    const existing = await this.getExisting(id);
    const nextRole: Role = dto.role ?? existing.role;
    const nextIsActive = dto.isActive ?? existing.isActive;
    const isSelf = existing.id === actor.id;

    if (isSelf && nextRole !== 'admin') {
      throw new BadRequestException('Anda tidak dapat menurunkan peran akun Anda sendiri.');
    }
    if (isSelf && !nextIsActive) {
      throw new BadRequestException('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }

    const losesAdminAccess =
      existing.role === 'admin' && existing.isActive && (nextRole !== 'admin' || !nextIsActive);
    if (losesAdminAccess) {
      await this.ensureAnotherActiveAdmin(existing.id);
    }

    const currentResearchIds = existing.researchAssignments.map((item) => item.researchId);
    const researchIds = this.normalizeResearchIds(nextRole, dto.researchIds ?? currentResearchIds);
    const researchChanged =
      researchIds.length !== currentResearchIds.length ||
      researchIds.some((researchId) => !currentResearchIds.includes(researchId));

    if (dto.email !== undefined || dto.identifier !== undefined) {
      await this.ensureUniqueCredentials(
        dto.email ?? existing.email,
        dto.identifier ?? existing.identifier,
        existing.id,
      );
    }
    if (researchChanged) {
      await this.ensureResearchExists(researchIds);
    }

    const passwordHash =
      dto.password !== undefined ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (researchChanged) {
          await tx.userResearchAssignment.deleteMany({ where: { userId: id } });
          if (researchIds.length > 0) {
            await tx.userResearchAssignment.createMany({
              data: researchIds.map((researchId) => ({ userId: id, researchId })),
            });
          }
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.identifier !== undefined ? { identifier: dto.identifier } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.role !== undefined ? { role: dto.role } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
          },
          include: userWithAssignments,
        });
      });

      return toUserAccountItem(updated);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<{ id: string; deleted: true }> {
    const existing = await this.getExisting(id);

    if (existing.id === actor.id) {
      throw new BadRequestException('Anda tidak dapat menghapus akun Anda sendiri.');
    }
    if (existing.role === 'admin' && existing.isActive) {
      await this.ensureAnotherActiveAdmin(existing.id);
    }

    try {
      // Relasi perwakilan riset ikut terhapus melalui ON DELETE CASCADE.
      await this.prisma.user.delete({ where: { id } });
      return { id, deleted: true };
    } catch (error: unknown) {
      if (isPrismaForeignKeyError(error)) {
        throw new ConflictException(
          'Pengguna masih dirujuk oleh data lain dan tidak dapat dihapus. Nonaktifkan akun sebagai gantinya.',
        );
      }
      throw error;
    }
  }

  private async getExisting(id: string): Promise<UserRecord> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: userWithAssignments,
    });
    if (!record) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }
    return record;
  }

  /** Admin tidak mewakili riset; Pengaju wajib mewakili tepat satu riset. */
  private normalizeResearchIds(role: Role, researchIds: readonly string[]): string[] {
    if (role === 'admin') {
      return [];
    }
    if (researchIds.length !== 1) {
      throw new BadRequestException('Pilih tepat satu riset yang diwakili Pengaju.');
    }
    return [...researchIds];
  }

  private async ensureResearchExists(researchIds: readonly string[]): Promise<void> {
    if (researchIds.length === 0) {
      return;
    }
    const found = await this.prisma.researchType.count({
      where: { id: { in: [...researchIds] } },
    });
    if (found !== researchIds.length) {
      throw new BadRequestException('Jenis riset tidak ditemukan.');
    }
  }

  private async ensureUniqueCredentials(
    email: string,
    identifier: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { identifier: { equals: identifier, mode: 'insensitive' } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Email atau NIP/NIM sudah digunakan.');
    }
  }

  private async ensureAnotherActiveAdmin(excludeId: string): Promise<void> {
    const otherAdmins = await this.prisma.user.count({
      where: { role: 'admin', isActive: true, id: { not: excludeId } },
    });
    if (otherAdmins === 0) {
      throw new ConflictException('Minimal harus ada satu akun Admin aktif.');
    }
  }

  private rethrowKnownError(error: unknown): never {
    if (isPrismaUniqueError(error)) {
      throw new ConflictException('Email atau NIP/NIM sudah digunakan.');
    }
    if (isPrismaForeignKeyError(error)) {
      throw new BadRequestException('Jenis riset tidak ditemukan.');
    }
    throw error;
  }
}
