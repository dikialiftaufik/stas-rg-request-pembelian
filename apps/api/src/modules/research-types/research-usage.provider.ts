import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ResearchUsageMetrics } from './research-types.types';

const ZERO_DECIMAL = new Prisma.Decimal(0);
const COMMITTED_STATUSES = new Set<RequestStatus>([
  'approved',
  'ordered',
  'in_transit',
  'delivered',
  'completed',
]);

@Injectable()
export class ResearchUsageProvider {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getUsageByResearchIds(
    researchIds: readonly string[],
  ): Promise<Map<string, ResearchUsageMetrics>> {
    const result = new Map<string, ResearchUsageMetrics>();
    if (researchIds.length === 0) {
      return result;
    }

    const [assignmentGroups, requests] = await Promise.all([
      this.prisma.userResearchAssignment.groupBy({
        by: ['researchId'],
        where: {
          researchId: { in: [...researchIds] },
        },
        _count: {
          userId: true,
        },
      }),
      typeof this.prisma.purchaseRequest?.findMany === 'function'
        ? this.prisma.purchaseRequest.findMany({
            where: {
              researchId: { in: [...researchIds] },
            },
            select: {
              researchId: true,
              deleted: true,
              status: true,
              quantity: true,
              unitPrice: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const userCountByResearchId = new Map<string, number>(
      assignmentGroups.map((group) => [group.researchId, group._count.userId]),
    );

    const committedById = new Map<string, Prisma.Decimal>();
    const activeCountById = new Map<string, number>();
    const totalRefCountById = new Map<string, number>();

    for (const req of requests) {
      totalRefCountById.set(req.researchId, (totalRefCountById.get(req.researchId) ?? 0) + 1);
      if (!req.deleted) {
        activeCountById.set(req.researchId, (activeCountById.get(req.researchId) ?? 0) + 1);
        if (COMMITTED_STATUSES.has(req.status)) {
          const prev = committedById.get(req.researchId) ?? ZERO_DECIMAL;
          committedById.set(req.researchId, prev.plus(req.unitPrice.times(req.quantity)));
        }
      }
    }

    for (const id of researchIds) {
      result.set(id, {
        committed: committedById.get(id) ?? ZERO_DECIMAL,
        requestCount: activeCountById.get(id) ?? 0,
        totalRequestsReferenced: totalRefCountById.get(id) ?? 0,
        rabDocumentCount: 0,
        assignedUserCount: userCountByResearchId.get(id) ?? 0,
      });
    }

    return result;
  }

  async getUsageForSingle(researchId: string): Promise<ResearchUsageMetrics> {
    const map = await this.getUsageByResearchIds([researchId]);
    return (
      map.get(researchId) ?? {
        committed: ZERO_DECIMAL,
        requestCount: 0,
        totalRequestsReferenced: 0,
        rabDocumentCount: 0,
        assignedUserCount: 0,
      }
    );
  }
}
