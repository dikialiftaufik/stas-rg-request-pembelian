import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PurchaseRequestsService, validateRequiredDateRange } from './purchase-requests.service';

interface StoredRequest {
  id: string;
  ownerId: string;
  researchId: string;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: Prisma.Decimal;
  requiredDate: string;
  url: string;
  notes: string;
  status:
    | 'pending_review'
    | 'approved'
    | 'ordered'
    | 'in_transit'
    | 'delivered'
    | 'completed'
    | 'rejected'
    | 'cancelled';
  submissionStatus: 'not_submitted' | 'submitted';
  deleted: boolean;
  revision: number;
  rabDocumentId: string | null;
  rabItemId: string | null;
  invoiceNumber: string | null;
  invoiceAmount: Prisma.Decimal | null;
  invoiceDate: string | null;
  invoiceUrl: string;
  invoiceUpdatedAt: Date | null;
  invoiceUpdatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoiceFile: {
    id: string;
    name: string;
    mime: string;
    size: number;
    uploadedAt: Date;
    uploadedById: string;
    content: Uint8Array;
  } | null;
  statusHistory: Array<{
    id: string;
    requestId: string;
    fromStatus: StoredRequest['status'];
    toStatus: StoredRequest['status'];
    actorId: string;
    reason: string;
    createdAt: Date;
  }>;
  replacements: Array<{
    id: string;
    requestId: string;
    url: string;
    unitPrice: Prisma.Decimal;
    reason: string;
    previousUrl: string;
    previousUnitPrice: Prisma.Decimal;
    originStatus: 'approved' | 'ordered';
    status: 'pending' | 'accepted' | 'rejected';
    createdById: string;
    createdAt: Date;
    respondedById: string | null;
    respondedAt: Date | null;
    response: string;
  }>;
}

function futureRequiredDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

function createInMemoryService() {
  const adminUser: AuthenticatedUser = {
    id: 'admin-1',
    name: 'Admin STAS-RG',
    identifier: '19870001',
    email: 'admin@gmail.com',
    role: 'admin',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const pengajuA: AuthenticatedUser = {
    id: 'pengaju-a',
    name: 'Pengaju Riset A',
    identifier: '2201001',
    email: 'pengaju.a@stas-rg.ac.id',
    role: 'pengaju',
    isActive: true,
    createdAt: new Date('2026-01-02T00:00:00Z'),
  };
  const pengajuB: AuthenticatedUser = {
    id: 'pengaju-b',
    name: 'Pengaju Riset B',
    identifier: '2201002',
    email: 'pengaju.b@stas-rg.ac.id',
    role: 'pengaju',
    isActive: true,
    createdAt: new Date('2026-01-03T00:00:00Z'),
  };

  const users = [
    { ...adminUser, researchAssignments: [] as Array<{ researchId: string }> },
    { ...pengajuA, researchAssignments: [{ researchId: 'research-a' }] },
    { ...pengajuB, researchAssignments: [{ researchId: 'research-b' }] },
  ];
  const researchTypes = [
    {
      id: 'research-a',
      name: 'Riset IoT Pertanian',
      description: '',
      allocated: new Prisma.Decimal('10000000'),
    },
    {
      id: 'research-b',
      name: 'Riset Visi Komputer',
      description: '',
      allocated: new Prisma.Decimal('5000000'),
    },
  ];
  const requests: StoredRequest[] = [];
  const notifications: Array<{
    id: string;
    recipientId: string;
    requestId: string;
    message: string;
    read: boolean;
    createdAt: Date;
  }> = [];

  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++counter)}`;

  const cloneForRead = (item: StoredRequest) => ({
    ...item,
    invoiceFile: item.invoiceFile
      ? {
          id: item.invoiceFile.id,
          name: item.invoiceFile.name,
          mime: item.invoiceFile.mime,
          size: item.invoiceFile.size,
          uploadedAt: item.invoiceFile.uploadedAt,
          uploadedById: item.invoiceFile.uploadedById,
        }
      : null,
    statusHistory: [...item.statusHistory],
    replacements: [...item.replacements],
  });

  const db = {
    user: {
      findMany: ({ where }: { where?: { id?: { in?: string[] }; role?: string; isActive?: boolean } }) =>
        Promise.resolve(
          users.filter((u) => {
            if (where?.id?.in && !where.id.in.includes(u.id)) return false;
            if (where?.role && u.role !== where.role) return false;
            if (where?.isActive !== undefined && u.isActive !== where.isActive) return false;
            return true;
          }),
        ),
    },
    userResearchAssignment: {
      findMany: ({ where }: { where: { userId: string } }) => {
        const found = users.find((u) => u.id === where.userId);
        return Promise.resolve(found ? found.researchAssignments : []);
      },
    },
    researchType: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(researchTypes.find((r) => r.id === where.id) ?? null),
    },
    purchaseRequest: {
      findMany: ({
        where,
      }: {
        where?: {
          deleted?: boolean;
          ownerId?: string;
          researchId?: string;
          id?: { not?: string };
          status?: { in?: StoredRequest['status'][] };
        };
      }) => {
        const filtered = requests.filter((r) => {
          if (where?.deleted !== undefined && r.deleted !== where.deleted) return false;
          if (where?.ownerId && r.ownerId !== where.ownerId) return false;
          if (where?.researchId && r.researchId !== where.researchId) return false;
          if (where?.id?.not && r.id === where.id.not) return false;
          if (where?.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
        return Promise.resolve(filtered.map(cloneForRead));
      },
      findUnique: ({ where }: { where: { id: string } }) => {
        const found = requests.find((r) => r.id === where.id);
        return Promise.resolve(found ? cloneForRead(found) : null);
      },
      create: ({
        data,
      }: {
        data: {
          ownerId: string;
          researchId: string;
          item: string;
          quantity: number;
          unit: string;
          unitPrice: Prisma.Decimal;
          requiredDate: string;
          url: string;
          notes: string;
          rabDocumentId: string | null;
          rabItemId: string | null;
        };
      }) => {
        const now = new Date();
        const created: StoredRequest = {
          id: nextId('req'),
          ...data,
          status: 'pending_review',
          submissionStatus: 'not_submitted',
          deleted: false,
          revision: 0,
          invoiceNumber: null,
          invoiceAmount: null,
          invoiceDate: null,
          invoiceUrl: '',
          invoiceUpdatedAt: null,
          invoiceUpdatedById: null,
          createdAt: now,
          updatedAt: now,
          invoiceFile: null,
          statusHistory: [],
          replacements: [],
        };
        requests.unshift(created);
        return Promise.resolve(cloneForRead(created));
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const found = requests.find((r) => r.id === where.id);
        if (!found) throw new Error('Not found');
        for (const [key, value] of Object.entries(data)) {
          if (key === 'revision' && typeof value === 'object' && value !== null && 'increment' in value) {
            found.revision += (value as { increment: number }).increment;
          } else {
            (found as unknown as Record<string, unknown>)[key] = value;
          }
        }
        found.updatedAt = new Date();
        return Promise.resolve(cloneForRead(found));
      },
    },
    requestStatusHistory: {
      create: ({
        data,
      }: {
        data: {
          requestId: string;
          fromStatus: StoredRequest['status'];
          toStatus: StoredRequest['status'];
          actorId: string;
          reason: string;
        };
      }) => {
        const found = requests.find((r) => r.id === data.requestId);
        if (!found) throw new Error('Request missing');
        const entry = { id: nextId('hist'), ...data, createdAt: new Date() };
        found.statusHistory.push(entry);
        return Promise.resolve(entry);
      },
    },
    requestReplacementProposal: {
      create: ({
        data,
      }: {
        data: {
          requestId: string;
          url: string;
          unitPrice: Prisma.Decimal;
          reason: string;
          previousUrl: string;
          previousUnitPrice: Prisma.Decimal;
          originStatus: 'approved' | 'ordered';
          status: 'pending';
          createdById: string;
        };
      }) => {
        const found = requests.find((r) => r.id === data.requestId);
        if (!found) throw new Error('Request missing');
        const entry = {
          id: nextId('rep'),
          ...data,
          createdAt: new Date(),
          respondedById: null,
          respondedAt: null,
          response: '',
        };
        found.replacements.push(entry);
        return Promise.resolve(entry);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          status: 'accepted' | 'rejected';
          response: string;
          respondedById: string;
          respondedAt: Date;
        };
      }) => {
        for (const req of requests) {
          const proposal = req.replacements.find((p) => p.id === where.id);
          if (proposal) {
            Object.assign(proposal, data);
            return Promise.resolve(proposal);
          }
        }
        throw new Error('Proposal missing');
      },
    },
    requestInvoiceFile: {
      findUnique: ({ where }: { where: { requestId: string } }) => {
        const found = requests.find((r) => r.id === where.requestId);
        return Promise.resolve(found?.invoiceFile ?? null);
      },
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { requestId: string };
        create: {
          requestId: string;
          name: string;
          mime: string;
          size: number;
          content: Uint8Array;
          uploadedAt: Date;
          uploadedById: string;
        };
        update: {
          name: string;
          mime: string;
          size: number;
          content: Uint8Array;
          uploadedAt: Date;
          uploadedById: string;
        };
      }) => {
        const found = requests.find((r) => r.id === where.requestId);
        if (!found) throw new Error('Request missing');
        if (found.invoiceFile) {
          Object.assign(found.invoiceFile, update);
        } else {
          found.invoiceFile = {
            id: nextId('invfile'),
            name: create.name,
            mime: create.mime,
            size: create.size,
            content: create.content,
            uploadedAt: create.uploadedAt,
            uploadedById: create.uploadedById,
          };
        }
        return Promise.resolve(found.invoiceFile);
      },
    },
    userNotification: {
      findMany: ({ where }: { where: { recipientId: string } }) =>
        Promise.resolve(notifications.filter((n) => n.recipientId === where.recipientId)),
      create: ({
        data,
      }: {
        data: { recipientId: string; requestId: string; message: string };
      }) => {
        const entry = {
          id: nextId('notif'),
          ...data,
          read: false,
          createdAt: new Date(),
        };
        notifications.unshift(entry);
        return Promise.resolve(entry);
      },
      createMany: ({
        data,
      }: {
        data: Array<{ recipientId: string; requestId: string; message: string }>;
      }) => {
        for (const row of data) {
          notifications.unshift({
            id: nextId('notif'),
            ...row,
            read: false,
            createdAt: new Date(),
          });
        }
        return Promise.resolve({ count: data.length });
      },
      updateMany: ({
        where,
      }: {
        where: { recipientId: string; read: boolean; id?: { in?: string[] } };
      }) => {
        let count = 0;
        for (const n of notifications) {
          if (
            n.recipientId === where.recipientId &&
            n.read === where.read &&
            (!where.id?.in || where.id.in.includes(n.id))
          ) {
            n.read = true;
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(db),
  };

  const service = new PurchaseRequestsService(db as unknown as PrismaService);
  return { service, adminUser, pengajuA, pengajuB, notifications };
}

describe('PurchaseRequestsService', () => {
  it('validates H-3 workday to H+180 date window', () => {
    const base = new Date('2026-11-05T03:00:00Z'); // Thursday in WIB
    expect(validateRequiredDateRange('2026-11-05', base)).toBe(false);
    expect(validateRequiredDateRange('2026-11-09', base)).toBe(false); // Monday (2 workdays)
    expect(validateRequiredDateRange('2026-11-10', base)).toBe(true); // Tuesday (3 workdays)
  });

  it('shows Pengaju submissions to both the owning Pengaju and Admin, while isolating other Pengaju', async () => {
    const { service, adminUser, pengajuA, pengajuB } = createInMemoryService();
    const requiredDate = futureRequiredDate();

    const created = await service.create(
      {
        item: 'Sensor Kelembaban Tanah',
        researchId: 'research-a',
        quantity: 4,
        unit: 'unit',
        unitPrice: '350000',
        requiredDate,
        url: 'https://toko.id/sensor',
        notes: 'Kebutuhan uji lapangan',
        rabDocumentId: null,
        rabItemId: null,
      },
      pengajuA,
    );

    expect(created.status).toBe('pending_review');
    expect(created.submissionStatus).toBe('not_submitted');
    expect(created.revision).toBe(0);

    const listPengajuA = await service.findAllForActor(pengajuA);
    const listPengajuB = await service.findAllForActor(pengajuB);
    const listAdmin = await service.findAllForActor(adminUser);

    expect(listPengajuA.data).toHaveLength(1);
    expect(listPengajuB.data).toHaveLength(0);
    expect(listAdmin.data).toHaveLength(1);
    expect(listAdmin.data[0]?.id).toBe(created.id);
    expect(listAdmin.meta.notifications.some((n) => n.requestId === created.id)).toBe(true);
  });

  it('rejects Pengaju from performing Admin actions and allows Admin to manage workflow, submission status, invoice, and replacement', async () => {
    const { service, adminUser, pengajuA } = createInMemoryService();
    const requiredDate = futureRequiredDate();

    const created = await service.create(
      {
        item: 'Modul LoRa SX1276',
        researchId: 'research-a',
        quantity: 2,
        unit: 'buah',
        unitPrice: '1500000',
        requiredDate,
        url: 'https://toko.id/lora',
        notes: '',
        rabDocumentId: null,
        rabItemId: null,
      },
      pengajuA,
    );

    await expect(
      service.changeStatusByAdmin(
        created.id,
        {
          expectedStatus: 'pending_review',
          expectedRevision: created.revision,
          nextStatus: 'approved',
          reason: '',
        },
        pengajuA,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const submitted = await service.updateSubmissionStatus(
      created.id,
      {
        expectedStatus: 'not_submitted',
        expectedRevision: created.revision,
        nextStatus: 'submitted',
      },
      adminUser,
    );
    expect(submitted.submissionStatus).toBe('submitted');
    expect(submitted.revision).toBe(1);

    const approved = await service.changeStatusByAdmin(
      created.id,
      {
        expectedStatus: 'pending_review',
        expectedRevision: submitted.revision,
        nextStatus: 'approved',
        reason: 'Anggaran sesuai',
      },
      adminUser,
    );
    expect(approved.status).toBe('approved');
    expect(approved.statusHistory).toHaveLength(1);

    // Replacement proposal by Admin, then approved by Pengaju
    const withProposal = await service.proposeReplacementByAdmin(
      created.id,
      {
        url: 'https://toko.id/lora-v2',
        unitPrice: '1600000',
        reason: 'Stok versi lama habis',
        expectedRevision: approved.revision,
      },
      adminUser,
    );
    const proposalId = withProposal.replacements[0]?.id ?? '';
    expect(proposalId).not.toBe('');

    // Status change blocked while replacement is pending
    await expect(
      service.changeStatusByAdmin(
        created.id,
        {
          expectedStatus: 'approved',
          expectedRevision: withProposal.revision,
          nextStatus: 'ordered',
          reason: '',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const acceptedProposal = await service.respondReplacementByPengaju(
      created.id,
      proposalId,
      {
        decision: 'accepted',
        response: 'Setuju dengan versi baru',
        expectedRevision: withProposal.revision,
      },
      pengajuA,
    );
    expect(acceptedProposal.unitPrice).toBe('1600000');
    expect(acceptedProposal.url).toBe('https://toko.id/lora-v2');

    const ordered = await service.changeStatusByAdmin(
      created.id,
      {
        expectedStatus: 'approved',
        expectedRevision: acceptedProposal.revision,
        nextStatus: 'ordered',
        reason: '',
      },
      adminUser,
    );
    const transit = await service.changeStatusByAdmin(
      created.id,
      {
        expectedStatus: 'ordered',
        expectedRevision: ordered.revision,
        nextStatus: 'in_transit',
        reason: '',
      },
      adminUser,
    );
    const delivered = await service.changeStatusByAdmin(
      created.id,
      {
        expectedStatus: 'in_transit',
        expectedRevision: transit.revision,
        nextStatus: 'delivered',
        reason: '',
      },
      adminUser,
    );

    // Cannot complete before invoice exists
    await expect(
      service.changeStatusByAdmin(
        created.id,
        {
          expectedStatus: 'delivered',
          expectedRevision: delivered.revision,
          nextStatus: 'completed',
          reason: '',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const invoiced = await service.saveInvoiceByAdmin(
      created.id,
      {
        number: 'INV/2026/099',
        amount: '3200000',
        invoiceDate: '2026-11-05',
        url: '',
        expectedRevision: delivered.revision,
      },
      {
        originalname: 'invoice-lora.pdf',
        mimetype: 'application/pdf',
        size: 12,
        buffer: Buffer.from('%PDF-1.4\nEOF'),
      },
      adminUser,
    );
    expect(invoiced.invoice?.number).toBe('INV/2026/099');
    expect(invoiced.invoice?.file?.sessionId).toBe('server');

    const completed = await service.changeStatusByAdmin(
      created.id,
      {
        expectedStatus: 'delivered',
        expectedRevision: invoiced.revision,
        nextStatus: 'completed',
        reason: 'Barang diterima baik',
      },
      adminUser,
    );
    expect(completed.status).toBe('completed');
  });

  it('enforces research budget allocation when approving requests', async () => {
    const { service, adminUser, pengajuB } = createInMemoryService();
    const requiredDate = futureRequiredDate();

    const overBudget = await service.create(
      {
        item: 'Workstation GPU',
        researchId: 'research-b',
        quantity: 1,
        unit: 'unit',
        unitPrice: '6000000', // research-b allocated is 5,000,000
        requiredDate,
        url: '',
        notes: '',
        rabDocumentId: null,
        rabItemId: null,
      },
      pengajuB,
    );

    await expect(
      service.changeStatusByAdmin(
        overBudget.id,
        {
          expectedStatus: 'pending_review',
          expectedRevision: overBudget.revision,
          nextStatus: 'approved',
          reason: '',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
