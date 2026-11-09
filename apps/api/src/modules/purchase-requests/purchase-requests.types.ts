import type { RequestStatus, SubmissionStatus } from '@prisma/client';
import type { UserRole } from '../auth/auth.types';

export interface RequestAttachmentMeta {
  id: string;
  sessionId: string;
  name: string;
  mime: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface RequestInvoiceItem {
  number: string | null;
  amount: string | null;
  invoiceDate: string | null;
  file: RequestAttachmentMeta | null;
  url: string;
  updatedAt: string;
  updatedBy: string;
}

export interface RequestStatusChangeItem {
  from: RequestStatus;
  to: RequestStatus;
  actorId: string;
  at: string;
  reason: string;
}

export interface RequestReplacementProposalItem {
  id: string;
  url: string;
  unitPrice: string;
  reason: string;
  previousUrl: string;
  previousUnitPrice: string;
  originStatus: 'approved' | 'ordered';
  status: 'pending' | 'accepted' | 'rejected';
  createdBy: string;
  createdAt: string;
  respondedBy: string | null;
  respondedAt: string | null;
  response: string;
}

export interface PurchaseRequestItem {
  id: string;
  /** `null` untuk data historis hasil impor Admin yang belum memiliki Pengaju. */
  ownerId: string | null;
  researchId: string;
  item: string;
  unit: string;
  quantity: number;
  unitPrice: string;
  requiredDate: string;
  url: string;
  notes: string;
  status: RequestStatus;
  submissionStatus: SubmissionStatus;
  createdAt: string;
  deleted: boolean;
  revision: number;
  rabDocumentId: string | null;
  rabItemId: string | null;
  invoice: RequestInvoiceItem | null;
  fulfillment: null;
  statusHistory: RequestStatusChangeItem[];
  replacements: RequestReplacementProposalItem[];
}

export interface RequestParticipantItem {
  id: string;
  name: string;
  identifier: string;
  email: string;
  role: UserRole;
  researchIds: string[];
  createdAt: string;
}

export interface UserNotificationItem {
  id: string;
  recipientId: string;
  requestId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PurchaseRequestListResponse {
  data: PurchaseRequestItem[];
  meta: {
    total: number;
    participants: RequestParticipantItem[];
    notifications: UserNotificationItem[];
  };
}

export interface PurchaseRequestImportResult {
  created: number;
  completed: number;
  pending: number;
  total: string;
  /** Peringatan non-blocking, misalnya komitmen riset melebihi alokasi. */
  warnings: string[];
}
