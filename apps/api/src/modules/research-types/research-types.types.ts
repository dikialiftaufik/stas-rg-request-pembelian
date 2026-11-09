import type { Prisma } from '@prisma/client';

export interface ResearchTypeItem {
  id: string;
  name: string;
  description: string;
  allocated: string;
  committed: string;
  remaining: string;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFundingSummary {
  totalAllocated: string;
  totalCommitted: string;
  totalRemaining: string;
}

export interface ResearchTypeListResponse {
  data: ResearchTypeItem[];
  meta: {
    total: number;
    summary: ResearchFundingSummary;
  };
}

export interface ResearchUsageMetrics {
  committed: Prisma.Decimal;
  requestCount: number;
  totalRequestsReferenced: number;
  rabDocumentCount: number;
  assignedUserCount: number;
}
