import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { formatMoneyDecimal } from '../research-types/research-types.service';
import type {
  ChangeRequestStatusDto,
  CreatePurchaseRequestDto,
  ImportPurchaseRequestsDto,
  MarkNotificationsReadDto,
  ProposeReplacementDto,
  RespondReplacementDto,
  SaveInvoiceMetadataDto,
  UpdatePurchaseRequestDto,
  UpdateSubmissionStatusDto,
} from './dto/purchase-request.dto';
import type {
  PurchaseRequestImportResult,
  PurchaseRequestItem,
  PurchaseRequestListResponse,
  RequestParticipantItem,
  UserNotificationItem,
} from './purchase-requests.types';

const ZERO_DECIMAL = new Prisma.Decimal(0);
const MAX_INVOICE_FILE_BYTES = 10 * 1024 * 1024;

export const COMMITTED_REQUEST_STATUSES: readonly RequestStatus[] = [
  'approved',
  'ordered',
  'in_transit',
  'delivered',
  'completed',
];

const INVOICE_ALLOWED_STATUSES: readonly RequestStatus[] = COMMITTED_REQUEST_STATUSES;

const ALLOWED_INVOICE_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const ALLOWED_STATUS_TRANSITIONS = new Map<RequestStatus, readonly RequestStatus[]>([
  ['pending_review', ['approved', 'rejected']],
  ['approved', ['ordered']],
  ['ordered', ['in_transit']],
  ['in_transit', ['delivered']],
  ['delivered', ['completed']],
]);

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending_review: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  ordered: 'Sudah Dipesan',
  in_transit: 'Dalam Pengiriman',
  delivered: 'Diterima',
  completed: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

const requestInclude = {
  invoiceFile: {
    select: {
      id: true,
      name: true,
      mime: true,
      size: true,
      uploadedAt: true,
      uploadedById: true,
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  replacements: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.PurchaseRequestInclude;

type RequestRecord = Prisma.PurchaseRequestGetPayload<{ include: typeof requestInclude }>;

export interface UploadedInvoiceFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function getJakartaDateIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function addCalendarDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function validateRequiredDateRange(value: string, now = new Date()): boolean {
  const today = getJakartaDateIso(now);
  let minimum = today;
  let businessDays = 0;
  while (businessDays < 3) {
    minimum = addCalendarDays(minimum, 1);
    const weekday = new Date(`${minimum}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      businessDays += 1;
    }
  }
  const maximum = addCalendarDays(today, 180);
  return value >= minimum && value <= maximum;
}

function isReplacementBlocked(
  replacements: readonly { status: 'pending' | 'accepted' | 'rejected' }[],
): boolean {
  const latest = replacements.at(-1);
  return Boolean(latest && latest.status !== 'accepted');
}

export function toPurchaseRequestItem(record: RequestRecord): PurchaseRequestItem {
  const hasInvoice =
    record.invoiceUpdatedAt !== null &&
    record.invoiceUpdatedById !== null &&
    (record.invoiceFile !== null || record.invoiceUrl.trim().length > 0);

  return {
    id: record.id,
    ownerId: record.ownerId,
    researchId: record.researchId,
    item: record.item,
    unit: record.unit,
    quantity: record.quantity,
    unitPrice: formatMoneyDecimal(record.unitPrice),
    requiredDate: record.requiredDate,
    url: record.url,
    notes: record.notes,
    status: record.status,
    submissionStatus: record.submissionStatus,
    createdAt: record.createdAt.toISOString(),
    deleted: record.deleted,
    revision: record.revision,
    rabDocumentId: record.rabDocumentId,
    rabItemId: record.rabItemId,
    invoice:
      hasInvoice && record.invoiceUpdatedAt && record.invoiceUpdatedById
        ? {
            number: record.invoiceNumber,
            amount: record.invoiceAmount ? formatMoneyDecimal(record.invoiceAmount) : null,
            invoiceDate: record.invoiceDate,
            file: record.invoiceFile
              ? {
                  id: record.invoiceFile.id,
                  sessionId: 'server',
                  name: record.invoiceFile.name,
                  mime: record.invoiceFile.mime,
                  size: record.invoiceFile.size,
                  uploadedAt: record.invoiceFile.uploadedAt.toISOString(),
                  uploadedBy: record.invoiceFile.uploadedById,
                }
              : null,
            url: record.invoiceUrl,
            updatedAt: record.invoiceUpdatedAt.toISOString(),
            updatedBy: record.invoiceUpdatedById,
          }
        : null,
    fulfillment: null,
    statusHistory: record.statusHistory.map((entry) => ({
      from: entry.fromStatus,
      to: entry.toStatus,
      actorId: entry.actorId,
      at: entry.createdAt.toISOString(),
      reason: entry.reason,
    })),
    replacements: record.replacements.map((proposal) => ({
      id: proposal.id,
      url: proposal.url,
      unitPrice: formatMoneyDecimal(proposal.unitPrice),
      reason: proposal.reason,
      previousUrl: proposal.previousUrl,
      previousUnitPrice: formatMoneyDecimal(proposal.previousUnitPrice),
      originStatus: proposal.originStatus,
      status: proposal.status,
      createdBy: proposal.createdById,
      createdAt: proposal.createdAt.toISOString(),
      respondedBy: proposal.respondedById,
      respondedAt: proposal.respondedAt ? proposal.respondedAt.toISOString() : null,
      response: proposal.response,
    })),
  };
}

@Injectable()
export class PurchaseRequestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAllForActor(actor: AuthenticatedUser): Promise<PurchaseRequestListResponse> {
    const records = await this.prisma.purchaseRequest.findMany({
      where: {
        deleted: false,
        ...(actor.role === 'admin' ? {} : { ownerId: actor.id }),
      },
      include: requestInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const participantIds = new Set<string>([actor.id]);
    for (const record of records) {
      if (record.ownerId) participantIds.add(record.ownerId);
      for (const history of record.statusHistory) {
        participantIds.add(history.actorId);
      }
    }

    const [participantRecords, notificationRecords] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...participantIds] } },
        include: {
          researchAssignments: {
            select: { researchId: true },
            orderBy: { assignedAt: 'asc' },
          },
        },
      }),
      this.prisma.userNotification.findMany({
        where: { recipientId: actor.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    ]);

    const participants: RequestParticipantItem[] = participantRecords.map((user) => ({
      id: user.id,
      name: user.name,
      identifier: user.identifier,
      email: user.email,
      role: user.role,
      researchIds: user.researchAssignments.map((item) => item.researchId),
      createdAt: user.createdAt.toISOString(),
    }));

    const notifications: UserNotificationItem[] = notificationRecords.map((item) => ({
      id: item.id,
      recipientId: item.recipientId,
      requestId: item.requestId,
      message: item.message,
      read: item.read,
      createdAt: item.createdAt.toISOString(),
    }));

    return {
      data: records.map(toPurchaseRequestItem),
      meta: {
        total: records.length,
        participants,
        notifications,
      },
    };
  }

  async findOneForActor(id: string, actor: AuthenticatedUser): Promise<PurchaseRequestItem> {
    return toPurchaseRequestItem(await this.getVisibleRequest(id, actor));
  }

  async create(dto: CreatePurchaseRequestDto, actor: AuthenticatedUser): Promise<PurchaseRequestItem> {
    if (actor.role !== 'pengaju') {
      throw new ForbiddenException('Pembuatan request tersedia untuk Pengaju.');
    }

    const assignments = await this.prisma.userResearchAssignment.findMany({
      where: { userId: actor.id },
      select: { researchId: true },
    });

    if (assignments.length !== 1) {
      throw new BadRequestException(
        'Akun Pengaju harus mewakili tepat satu riset. Minta Admin memperbarui profil Anda.',
      );
    }

    if (assignments[0]?.researchId !== dto.researchId) {
      throw new BadRequestException(
        'Riset pengajuan harus sesuai riset perwakilan akun. Muat ulang form atau hubungi Admin.',
      );
    }

    const research = await this.prisma.researchType.findUnique({
      where: { id: dto.researchId },
    });
    if (!research) {
      throw new BadRequestException('Jenis riset tidak dapat digunakan.');
    }

    if (!validateRequiredDateRange(dto.requiredDate)) {
      throw new BadRequestException(
        'Tanggal kebutuhan harus H-3 hari kerja sampai maksimal 180 hari ke depan.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.purchaseRequest.create({
        data: {
          ownerId: actor.id,
          researchId: dto.researchId,
          item: dto.item,
          unit: dto.unit,
          quantity: dto.quantity,
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          requiredDate: dto.requiredDate,
          url: dto.url,
          notes: dto.notes,
          rabDocumentId: dto.rabDocumentId,
          rabItemId: dto.rabItemId,
        },
        include: requestInclude,
      });

      const admins = await tx.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.userNotification.createMany({
          data: admins.map((admin) => ({
            recipientId: admin.id,
            requestId: request.id,
            message: `${request.item} menunggu persetujuan.`,
          })),
        });
      }

      return request;
    });

    return toPurchaseRequestItem(created);
  }

  async updateByAdmin(
    id: string,
    dto: UpdatePurchaseRequestDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    this.requireAdmin(actor);
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, dto.expectedRevision);

    if (isReplacementBlocked(existing.replacements)) {
      throw new ConflictException('Tuntaskan penawaran pengganti sebelum mengedit barang.');
    }

    const nextPrice = new Prisma.Decimal(dto.unitPrice);
    if (
      existing.status !== 'pending_review' &&
      (dto.url !== existing.url || !nextPrice.eq(existing.unitPrice))
    ) {
      throw new BadRequestException(
        'Gunakan Ajukan link pengganti untuk mengubah tautan atau harga setelah persetujuan.',
      );
    }

    if (dto.requiredDate !== existing.requiredDate && !validateRequiredDateRange(dto.requiredDate)) {
      throw new BadRequestException(
        'Tanggal kebutuhan harus H-3 hari kerja sampai maksimal 180 hari ke depan.',
      );
    }

    const research = await this.prisma.researchType.findUnique({
      where: { id: dto.researchId },
    });
    if (!research) {
      throw new BadRequestException('Jenis riset tidak dapat digunakan.');
    }

    if (COMMITTED_REQUEST_STATUSES.includes(existing.status)) {
      await this.ensureBudgetFits(
        dto.researchId,
        research.allocated,
        existing.id,
        nextPrice.times(dto.quantity),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.purchaseRequest.update({
        where: { id },
        data: {
          item: dto.item,
          unit: dto.unit,
          researchId: dto.researchId,
          quantity: dto.quantity,
          unitPrice: nextPrice,
          requiredDate: dto.requiredDate,
          url: dto.url,
          notes: dto.notes,
          rabDocumentId: existing.researchId === dto.researchId ? existing.rabDocumentId : null,
          rabItemId: existing.researchId === dto.researchId ? existing.rabItemId : null,
          revision: { increment: 1 },
        },
        include: requestInclude,
      });

      if (existing.ownerId) await tx.userNotification.create({
        data: {
          recipientId: existing.ownerId,
          requestId: existing.id,
          message: `${saved.item} diperbarui oleh Admin.`,
        },
      });

      return saved;
    });

    return toPurchaseRequestItem(updated);
  }

  async removeByAdmin(
    id: string,
    expectedRevision: number | undefined,
    actor: AuthenticatedUser,
  ): Promise<{ id: string; deleted: true }> {
    this.requireAdmin(actor);
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, expectedRevision);

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseRequest.update({
        where: { id },
        data: {
          deleted: true,
          revision: { increment: 1 },
        },
      });

      if (existing.ownerId) await tx.userNotification.create({
        data: {
          recipientId: existing.ownerId,
          requestId: existing.id,
          message: `${existing.item} dihapus dari daftar oleh Admin.`,
        },
      });
    });

    return { id, deleted: true };
  }

  async cancelByPengaju(
    id: string,
    expectedRevision: number | undefined,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, expectedRevision);

    if (
      actor.role !== 'pengaju' ||
      existing.ownerId !== actor.id ||
      existing.status !== 'pending_review'
    ) {
      throw new BadRequestException(
        'Hanya request sendiri yang menunggu persetujuan yang dapat dibatalkan.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestStatusHistory.create({
        data: {
          requestId: existing.id,
          fromStatus: existing.status,
          toStatus: 'cancelled',
          actorId: actor.id,
          reason: 'Dibatalkan oleh Pengaju.',
        },
      });

      const saved = await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: 'cancelled',
          revision: { increment: 1 },
        },
        include: requestInclude,
      });

      const admins = await tx.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.userNotification.createMany({
          data: admins.map((admin) => ({
            recipientId: admin.id,
            requestId: existing.id,
            message: `${existing.item} dibatalkan oleh Pengaju.`,
          })),
        });
      }

      return saved;
    });

    return toPurchaseRequestItem(updated);
  }

  async updateSubmissionStatus(
    id: string,
    dto: UpdateSubmissionStatusDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    this.requireAdmin(actor);
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, dto.expectedRevision);

    if (existing.submissionStatus !== dto.expectedStatus) {
      throw new ConflictException(
        'Status pengajuan sudah berubah. Tutup pilihan lalu buka kembali untuk melihat nilai terbaru.',
      );
    }

    if (existing.submissionStatus === dto.nextStatus) {
      return toPurchaseRequestItem(existing);
    }

    const updated = await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        submissionStatus: dto.nextStatus,
        revision: { increment: 1 },
      },
      include: requestInclude,
    });

    return toPurchaseRequestItem(updated);
  }

  async changeStatusByAdmin(
    id: string,
    dto: ChangeRequestStatusDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    this.requireAdmin(actor);
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, dto.expectedRevision);

    if (isReplacementBlocked(existing.replacements)) {
      throw new ConflictException(
        'Pembelian dijeda. Tuntaskan penawaran pengganti terlebih dahulu.',
      );
    }

    if (existing.status !== dto.expectedStatus) {
      throw new ConflictException(
        'Status sudah berubah. Tutup lalu buka kembali form untuk melihat status terbaru.',
      );
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS.get(existing.status) ?? [];
    if (!allowedNext.includes(dto.nextStatus)) {
      throw new BadRequestException(
        'Perubahan status tidak diizinkan. Pilih tahapan berikutnya yang tersedia.',
      );
    }

    if (dto.nextStatus === 'completed') {
      const hasValidInvoice =
        Boolean(existing.invoiceNumber?.trim()) &&
        existing.invoiceAmount !== null &&
        existing.invoiceAmount.gt(0) &&
        Boolean(existing.invoiceDate) &&
        (existing.invoiceFile !== null || existing.invoiceUrl.trim().length > 0);
      if (!hasValidInvoice) {
        throw new BadRequestException('Lengkapi invoice sebelum menyelesaikan Pembelian Barang.');
      }
    }

    const reason = dto.reason.trim();
    if (dto.nextStatus === 'rejected' && !reason) {
      throw new BadRequestException(
        'Jelaskan alasan penolakan agar Pengaju dapat menindaklanjuti.',
      );
    }

    if (COMMITTED_REQUEST_STATUSES.includes(dto.nextStatus)) {
      const research = await this.prisma.researchType.findUnique({
        where: { id: existing.researchId },
      });
      if (!research) {
        throw new BadRequestException('Jenis riset tidak ditemukan.');
      }
      await this.ensureBudgetFits(
        existing.researchId,
        research.allocated,
        existing.id,
        existing.unitPrice.times(existing.quantity),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestStatusHistory.create({
        data: {
          requestId: existing.id,
          fromStatus: existing.status,
          toStatus: dto.nextStatus,
          actorId: actor.id,
          reason,
        },
      });

      const saved = await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: dto.nextStatus,
          revision: { increment: 1 },
        },
        include: requestInclude,
      });

      const statusLabel = STATUS_LABELS[dto.nextStatus];
      if (existing.ownerId) await tx.userNotification.create({
        data: {
          recipientId: existing.ownerId,
          requestId: existing.id,
          message: `${existing.item}: ${statusLabel}.${reason ? ` ${reason}` : ''}`,
        },
      });

      return saved;
    });

    return toPurchaseRequestItem(updated);
  }

  async saveInvoiceByAdmin(
    id: string,
    dto: SaveInvoiceMetadataDto,
    file: UploadedInvoiceFileInput | undefined,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    this.requireAdmin(actor);
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, dto.expectedRevision);

    if (!INVOICE_ALLOWED_STATUSES.includes(existing.status)) {
      throw new BadRequestException('Invoice dapat ditambahkan setelah request disetujui.');
    }

    const todayJakarta = getJakartaDateIso();
    if (dto.invoiceDate > todayJakarta) {
      throw new BadRequestException('Tanggal invoice tidak boleh melewati hari ini.');
    }

    const currentUpdatedAt = existing.invoiceUpdatedAt
      ? existing.invoiceUpdatedAt.toISOString()
      : null;
    if (dto.expectedUpdatedAt !== undefined && currentUpdatedAt !== dto.expectedUpdatedAt) {
      throw new ConflictException('Invoice sudah berubah. Buka kembali dokumen terbaru.');
    }

    if (file) {
      if (file.size <= 0 || file.size > MAX_INVOICE_FILE_BYTES) {
        throw new BadRequestException('Ukuran file invoice maksimal 10 MB.');
      }
      if (!ALLOWED_INVOICE_MIMES.has(file.mimetype)) {
        throw new BadRequestException(
          'Format file invoice harus PDF, XLSX, DOCX, PNG, JPEG, atau WebP.',
        );
      }
    }

    const willHaveFile = Boolean(file ?? existing.invoiceFile);
    const trimmedUrl = dto.url.trim();
    if (!willHaveFile && !trimmedUrl) {
      throw new BadRequestException('Unggah file atau isi tautan invoice.');
    }

    const nextTimestamp = new Date(
      Math.max(
        Date.now(),
        existing.invoiceUpdatedAt ? existing.invoiceUpdatedAt.getTime() + 1 : 0,
      ),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (file) {
        await tx.requestInvoiceFile.upsert({
          where: { requestId: existing.id },
          update: {
            name: file.originalname,
            mime: file.mimetype,
            size: file.size,
            content: new Uint8Array(file.buffer),
            uploadedById: actor.id,
            uploadedAt: nextTimestamp,
          },
          create: {
            requestId: existing.id,
            name: file.originalname,
            mime: file.mimetype,
            size: file.size,
            content: new Uint8Array(file.buffer),
            uploadedById: actor.id,
            uploadedAt: nextTimestamp,
          },
        });
      }

      const saved = await tx.purchaseRequest.update({
        where: { id },
        data: {
          invoiceNumber: dto.number,
          invoiceAmount: new Prisma.Decimal(dto.amount),
          invoiceDate: dto.invoiceDate,
          invoiceUrl: trimmedUrl,
          invoiceUpdatedAt: nextTimestamp,
          invoiceUpdatedById: actor.id,
          revision: { increment: 1 },
        },
        include: requestInclude,
      });

      if (existing.ownerId) await tx.userNotification.create({
        data: {
          recipientId: existing.ownerId,
          requestId: existing.id,
          message: `Invoice ${existing.item} tersedia untuk dilihat.`,
        },
      });

      return saved;
    });

    return toPurchaseRequestItem(updated);
  }

  async getInvoiceFileForActor(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ name: string; mime: string; size: number; content: Buffer }> {
    const existing = await this.getVisibleRequest(id, actor);
    const fileRecord = await this.prisma.requestInvoiceFile.findUnique({
      where: { requestId: existing.id },
    });

    if (!fileRecord) {
      throw new NotFoundException('Invoice belum memiliki file.');
    }

    return {
      name: fileRecord.name,
      mime: fileRecord.mime,
      size: fileRecord.size,
      content: Buffer.from(fileRecord.content),
    };
  }

  async proposeReplacementByAdmin(
    id: string,
    dto: ProposeReplacementDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    this.requireAdmin(actor);
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, dto.expectedRevision);

    if (existing.status !== 'approved' && existing.status !== 'ordered') {
      throw new BadRequestException(
        'Penawaran pengganti hanya tersedia setelah disetujui dan sebelum pengiriman.',
      );
    }

    if (existing.replacements.at(-1)?.status === 'pending') {
      throw new ConflictException('Tunggu tanggapan Pengaju sebelum mengirim penawaran lain.');
    }

    const nextUnitPrice = new Prisma.Decimal(dto.unitPrice);
    if (dto.url === existing.url && nextUnitPrice.eq(existing.unitPrice)) {
      throw new BadRequestException('Ubah tautan atau harga untuk mengirim penawaran pengganti.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestReplacementProposal.create({
        data: {
          requestId: existing.id,
          url: dto.url,
          unitPrice: nextUnitPrice,
          reason: dto.reason,
          previousUrl: existing.url,
          previousUnitPrice: existing.unitPrice,
          originStatus: existing.status as 'approved' | 'ordered',
          status: 'pending',
          createdById: actor.id,
        },
      });

      const saved = await tx.purchaseRequest.update({
        where: { id },
        data: { revision: { increment: 1 } },
        include: requestInclude,
      });

      if (existing.ownerId) await tx.userNotification.create({
        data: {
          recipientId: existing.ownerId,
          requestId: existing.id,
          message: `Penawaran pengganti ${existing.item} perlu Anda tinjau.`,
        },
      });

      return saved;
    });

    return toPurchaseRequestItem(updated);
  }

  async respondReplacementByPengaju(
    id: string,
    proposalId: string,
    dto: RespondReplacementDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestItem> {
    const existing = await this.getVisibleRequest(id, actor);
    this.ensureRevision(existing.revision, dto.expectedRevision);

    if (existing.status !== 'approved' && existing.status !== 'ordered') {
      throw new BadRequestException(
        'Penawaran pengganti hanya tersedia setelah disetujui dan sebelum pengiriman.',
      );
    }

    if (actor.role !== 'pengaju' || existing.ownerId !== actor.id) {
      throw new ForbiddenException(
        'Hanya Pengaju pemilik request yang dapat menanggapi penawaran.',
      );
    }

    const latest = existing.replacements.at(-1);
    if (!latest || latest.id !== proposalId || latest.status !== 'pending') {
      throw new ConflictException('Penawaran pengganti sudah ditanggapi atau tidak aktif.');
    }

    const trimmedResponse = dto.response.trim();
    if (dto.decision === 'rejected' && !trimmedResponse) {
      throw new BadRequestException('Jelaskan alasan meminta alternatif lain.');
    }

    if (dto.decision === 'accepted') {
      const research = await this.prisma.researchType.findUnique({
        where: { id: existing.researchId },
      });
      if (!research) {
        throw new BadRequestException('Jenis riset tidak ditemukan.');
      }
      await this.ensureBudgetFits(
        existing.researchId,
        research.allocated,
        existing.id,
        latest.unitPrice.times(existing.quantity),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requestReplacementProposal.update({
        where: { id: latest.id },
        data: {
          status: dto.decision,
          respondedById: actor.id,
          respondedAt: new Date(),
          response: dto.decision === 'accepted' ? '' : trimmedResponse,
        },
      });

      const saved = await tx.purchaseRequest.update({
        where: { id },
        data: {
          ...(dto.decision === 'accepted'
            ? { url: latest.url, unitPrice: latest.unitPrice }
            : {}),
          revision: { increment: 1 },
        },
        include: requestInclude,
      });

      const admins = await tx.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      });

      if (admins.length > 0) {
        const suffix =
          dto.decision === 'accepted'
            ? 'penawaran pengganti disetujui.'
            : 'Pengaju meminta alternatif lain.';
        await tx.userNotification.createMany({
          data: admins.map((admin) => ({
            recipientId: admin.id,
            requestId: existing.id,
            message: `${existing.item}: ${suffix}`,
          })),
        });
      }

      return saved;
    });

    return toPurchaseRequestItem(updated);
  }

  /**
   * Mengimpor data Pembelian Barang historis (misalnya dari spreadsheet lama) ke satu riset.
   *
   * Baris tidak memiliki Pengaju (`ownerId = null`). Tanggal baris dipakai sebagai tanggal
   * pengajuan dan tanggal kebutuhan agar analitik dashboard mengikuti tanggal asli. Baris yang
   * sudah dibeli langsung berstatus Selesai beserta nominal/tautan invoice. Alokasi riset tidak
   * memblokir impor; kelebihan komitmen dikembalikan sebagai peringatan.
   */
  async importByAdmin(
    dto: ImportPurchaseRequestsDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestImportResult> {
    this.requireAdmin(actor);

    const research = await this.prisma.researchType.findUnique({
      where: { id: dto.researchId },
    });
    if (!research) {
      throw new BadRequestException('Jenis riset tujuan tidak ditemukan. Tambahkan riset terlebih dahulu.');
    }

    const sourceLabel = dto.sourceName ? `Diimpor dari ${dto.sourceName}.` : 'Diimpor dari data historis.';

    let importTotal = ZERO_DECIMAL;
    let completedTotal = ZERO_DECIMAL;
    let completed = 0;

    const rows = dto.rows.map((row, index) => {
      const unitPrice = new Prisma.Decimal(row.unitPrice);
      const total = unitPrice.times(row.quantity);
      importTotal = importTotal.plus(total);
      if (row.completed) {
        completed += 1;
        completedTotal = completedTotal.plus(total);
      }
      // 12.00 WIB pada tanggal baris; offset milidetik menjaga urutan sesuai file.
      const createdAt = new Date(Date.parse(`${row.date}T05:00:00.000Z`) + index);
      const notes = [sourceLabel, row.notes].filter(Boolean).join('\n');
      return { row, unitPrice, total, createdAt, notes };
    });

    await this.prisma.$transaction(
      async (tx) => {
        for (const { row, unitPrice, total, createdAt, notes } of rows) {
          await tx.purchaseRequest.create({
            data: {
              ownerId: null,
              researchId: research.id,
              item: row.item,
              quantity: row.quantity,
              unitPrice,
              requiredDate: row.date,
              url: row.url,
              notes,
              status: row.completed ? 'completed' : 'pending_review',
              createdAt,
              ...(row.completed
                ? {
                    invoiceAmount: row.invoiceAmount
                      ? new Prisma.Decimal(row.invoiceAmount)
                      : total,
                    invoiceDate: row.date,
                    invoiceUrl: row.invoiceUrl,
                    invoiceUpdatedAt: createdAt,
                    invoiceUpdatedById: actor.id,
                    statusHistory: {
                      create: {
                        fromStatus: 'pending_review',
                        toStatus: 'completed',
                        actorId: actor.id,
                        reason: sourceLabel,
                        createdAt,
                      },
                    },
                  }
                : {}),
            },
          });
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    const warnings: string[] = [];
    if (completedTotal.gt(0)) {
      const committed = await this.prisma.purchaseRequest.findMany({
        where: {
          researchId: research.id,
          deleted: false,
          status: { in: [...COMMITTED_REQUEST_STATUSES] },
        },
        select: { quantity: true, unitPrice: true },
      });
      const used = committed.reduce(
        (sum, req) => sum.plus(req.unitPrice.times(req.quantity)),
        ZERO_DECIMAL,
      );
      if (used.gt(research.allocated)) {
        warnings.push(
          `Komitmen riset ${research.name} kini Rp${formatMoneyDecimal(used)} dan melebihi alokasi Rp${formatMoneyDecimal(research.allocated)}. Perbarui alokasi riset bila diperlukan.`,
        );
      }
    }

    return {
      created: rows.length,
      completed,
      pending: rows.length - completed,
      total: formatMoneyDecimal(importTotal),
      warnings,
    };
  }

  async markNotificationsRead(
    dto: MarkNotificationsReadDto,
    actor: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    const result = await this.prisma.userNotification.updateMany({
      where: {
        recipientId: actor.id,
        read: false,
        ...(dto.ids && dto.ids.length > 0 ? { id: { in: dto.ids } } : {}),
      },
      data: { read: true },
    });
    return { updated: result.count };
  }

  private async getVisibleRequest(id: string, actor: AuthenticatedUser): Promise<RequestRecord> {
    const record = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: requestInclude,
    });

    if (!record || record.deleted || (actor.role !== 'admin' && record.ownerId !== actor.id)) {
      throw new NotFoundException('Request tidak ditemukan atau tidak dapat diakses.');
    }

    return record;
  }

  private requireAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Tindakan ini hanya tersedia untuk Admin.');
    }
  }

  private ensureRevision(actual: number, expected?: number): void {
    if (expected !== undefined && actual !== expected) {
      throw new ConflictException('Data sudah berubah. Muat ulang halaman sebelum melanjutkan.');
    }
  }

  private async ensureBudgetFits(
    researchId: string,
    allocated: Prisma.Decimal,
    excludeRequestId: string,
    additionalAmount: Prisma.Decimal,
  ): Promise<void> {
    const otherCommitted = await this.prisma.purchaseRequest.findMany({
      where: {
        researchId,
        deleted: false,
        status: { in: [...COMMITTED_REQUEST_STATUSES] },
        id: { not: excludeRequestId },
      },
      select: {
        quantity: true,
        unitPrice: true,
      },
    });

    const usedOthers = otherCommitted.reduce(
      (sum, req) => sum.plus(req.unitPrice.times(req.quantity)),
      ZERO_DECIMAL,
    );

    if (usedOthers.plus(additionalAmount).gt(allocated)) {
      throw new BadRequestException(
        'Alokasi dana riset tidak mencukupi. Periksa alokasi sebelum menyetujui request.',
      );
    }
  }
}
