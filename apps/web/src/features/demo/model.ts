import Decimal from 'decimal.js';
import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'pengaju']);
export const submissionStatusSchema = z.enum(['not_submitted', 'submitted']);
export const submissionStatusLabels = {
  not_submitted: 'Belum diajukan',
  submitted: 'Sudah diajukan',
} as const;
export const statusSchema = z.enum([
  'pending_review',
  'approved',
  'ordered',
  'in_transit',
  'delivered',
  'completed',
  'rejected',
  'cancelled',
]);
export const moneySchema = z.string().refine((value) => {
  const [integer, fraction, ...extra] = value.split('.');
  const valid =
    extra.length === 0 &&
    /^\d+$/.test(integer ?? '') &&
    (fraction === undefined || /^\d{1,2}$/.test(fraction));
  return valid && new Decimal(value).isFinite();
}, 'Masukkan nominal yang valid.');
const positiveMoneySchema = moneySchema.pipe(
  z.string().refine((value) => new Decimal(value).gt(0), 'Nominal harus lebih dari nol.'),
);
export const userInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi.'),
    identifier: z.string().trim().min(1, 'NIP/NIM wajib diisi.'),
    email: z.email('Email tidak valid.').transform((value) => value.toLowerCase()),
    role: roleSchema,
    researchIds: z.array(z.string()),
  })
  .refine((value) => value.role === 'admin' || value.researchIds.length === 1, {
    message: 'Pilih tepat satu riset yang diwakili Pengaju.',
    path: ['researchIds'],
  });
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  email: z.email(),
  role: roleSchema,
  researchIds: z.array(z.string()),
  createdAt: z.iso.datetime(),
});
export const researchInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama riset wajib diisi.'),
  description: z.string().trim(),
  allocated: positiveMoneySchema,
});
export const researchSchema = researchInputSchema.extend({ id: z.string() });
export const attachmentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string().min(1),
  mime: z.string(),
  size: z
    .number()
    .positive()
    .max(10 * 1024 * 1024),
  uploadedAt: z.iso.datetime(),
  uploadedBy: z.string(),
});
export const webUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Gunakan tautan HTTP atau HTTPS yang lengkap.');
export const invoiceSchema = z
  .object({
    amount: positiveMoneySchema.nullable().default(null),
    invoiceDate: z.iso.date().nullable().default(null),
    file: attachmentSchema.nullable(),
    url: webUrlSchema,
    updatedAt: z.iso.datetime(),
    updatedBy: z.string(),
  })
  .refine((value) => Boolean(value.file || value.url), 'Unggah file atau isi tautan invoice.');
export const invoiceInputSchema = z.object({
  amount: positiveMoneySchema,
  invoiceDate: z.iso
    .date('Tanggal invoice tidak valid.')
    .refine(
      (value) => value <= formatInTimeZone(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
      'Tanggal invoice tidak boleh melewati hari ini.',
    ),
});
export const fulfillmentInputSchema = z.object({
  supplier: z.string().trim().max(200, 'Nama pemasok maksimal 200 karakter.'),
  courier: z.string().trim().max(120, 'Nama kurir maksimal 120 karakter.'),
  trackingNumber: z.string().trim().max(120, 'Nomor resi maksimal 120 karakter.'),
  estimatedArrival: z.iso.date('Tanggal estimasi tidak valid.').nullable(),
  notes: z.string().trim().max(2000, 'Catatan maksimal 2.000 karakter.'),
});
export const fulfillmentSchema = fulfillmentInputSchema.extend({
  updatedAt: z.iso.datetime(),
  updatedBy: z.string(),
});
export type FulfillmentInfo = z.infer<typeof fulfillmentSchema>;
export type FulfillmentInput = z.infer<typeof fulfillmentInputSchema>;
export const rabItemInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama barang wajib diisi.'),
  quantity: z.number().int('Jumlah harus bilangan bulat.').positive('Jumlah minimal satu.'),
  unit: z.string().trim().min(1, 'Satuan wajib diisi.'),
  unitPrice: positiveMoneySchema,
  notes: z.string().trim(),
});
export const rabItemSchema = rabItemInputSchema.extend({ id: z.string() });
export const rabDocumentSchema = z.object({
  id: z.string(),
  researchId: z.string(),
  name: z.string().trim().min(1),
  version: z.number().int().positive(),
  active: z.boolean(),
  source: attachmentSchema,
  sourceKind: z.enum(['upload', 'demo']).default('upload'),
  createdAt: z.iso.datetime(),
  createdBy: z.string(),
  items: z.array(rabItemSchema).min(1).max(1000),
});
export type AttachmentRef = z.infer<typeof attachmentSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type RabDocument = z.infer<typeof rabDocumentSchema>;
export type RabItem = z.infer<typeof rabItemSchema>;
export type RabItemInput = z.infer<typeof rabItemInputSchema>;

export const requestInputSchema = z.object({
  item: z.string().trim().min(1, 'Nama barang wajib diisi.'),
  unit: z.string().trim().min(1, 'Satuan wajib diisi.'),
  researchId: z.string().min(1, 'Riset perwakilan belum tersedia. Hubungi Admin.'),
  quantity: z.number().int('Jumlah harus bilangan bulat.').min(1, 'Jumlah minimal satu.'),
  unitPrice: positiveMoneySchema,
  requiredDate: z.iso.date('Tanggal tidak valid.'),
  url: z.string().refine((value) => {
    if (!value) return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Gunakan URL HTTP atau HTTPS.'),
  notes: z.string().trim(),
});
export const statusChangeSchema = z.object({
  from: statusSchema,
  to: statusSchema,
  actorId: z.string(),
  at: z.iso.datetime(),
  reason: z.string(),
});
export const requestSchema = requestInputSchema.extend({
  id: z.string(),
  ownerId: z.string(),
  unit: z.string().trim().min(1).default('unit'),
  invoice: invoiceSchema.nullable().default(null),
  fulfillment: fulfillmentSchema.nullable().default(null),
  rabDocumentId: z.string().nullable().default(null),
  rabItemId: z.string().nullable().default(null),
  status: statusSchema,
  submissionStatus: submissionStatusSchema.default('not_submitted'),
  createdAt: z.iso.datetime(),
  deleted: z.boolean(),
  statusHistory: z.array(statusChangeSchema).default([]),
});
const notificationSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  requestId: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const snapshotSchema = z
  .object({
    version: z.literal(1),
    demoRevision: z.number().int().nonnegative().default(0),
    accountId: z.enum(['demo-admin', 'demo-pengaju']).nullable(),
    adminNoticeSeen: z.boolean().default(false),
    users: z.array(userSchema),
    research: z.array(researchSchema),
    requests: z.array(requestSchema),
    notifications: z.array(notificationSchema),
    rabDocuments: z.array(rabDocumentSchema).default([]),
  })
  .superRefine((value, context) => {
    const users = new Set(value.users.map((user) => user.id));
    const research = new Set(value.research.map((item) => item.id));
    if (
      !users.has('demo-admin') ||
      !users.has('demo-pengaju') ||
      value.requests.some(
        (request) => !users.has(request.ownerId) || !research.has(request.researchId),
      ) ||
      value.users.some((user) => user.researchIds.some((id) => !research.has(id))) ||
      value.rabDocuments.some(
        (doc) => !research.has(doc.researchId) || !users.has(doc.createdBy),
      ) ||
      value.requests.some(
        (request) =>
          request.rabDocumentId !== null &&
          !value.rabDocuments.some(
            (doc) =>
              doc.id === request.rabDocumentId &&
              doc.researchId === request.researchId &&
              doc.items.some((item) => item.id === request.rabItemId),
          ),
      ) ||
      users.size !== value.users.length ||
      research.size !== value.research.length
    ) {
      context.addIssue({ code: 'custom', message: 'Data demo tidak konsisten.' });
    }
  });

export type DemoRole = z.infer<typeof roleSchema>;
export type RequestStatus = z.infer<typeof statusSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type RequestStatusChange = z.infer<typeof statusChangeSchema>;
export type DemoUser = z.infer<typeof userSchema>;
export type DemoResearch = z.infer<typeof researchSchema>;
export type DemoRequest = z.infer<typeof requestSchema>;
export type DemoSnapshot = z.infer<typeof snapshotSchema>;
export type UserInput = z.infer<typeof userInputSchema>;
export type ResearchInput = z.infer<typeof researchInputSchema>;
export type RequestInput = z.infer<typeof requestInputSchema>;

export const statusLabels: Record<RequestStatus, string> = {
  pending_review: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  ordered: 'Sudah Dipesan',
  in_transit: 'Dalam Pengiriman',
  delivered: 'Diterima',
  completed: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};
export const statusLabelMap = new Map(Object.entries(statusLabels));
export const requestTotal = (request: Pick<DemoRequest, 'unitPrice' | 'quantity'>) =>
  new Decimal(request.unitPrice).times(request.quantity);
export const formatMoney = (value: Decimal.Value) =>
  `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(new Decimal(value).toNumber())}`;
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value.includes('T') ? value : `${value}T12:00:00+07:00`));

function addCalendarDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function requestDateLimits(now = new Date()) {
  const today = formatInTimeZone(now, 'Asia/Jakarta', 'yyyy-MM-dd');
  let minimum = today;
  let days = 0;
  while (days < 3) {
    minimum = addCalendarDays(minimum, 1);
    const weekday = new Date(`${minimum}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return { minimum, maximum: addCalendarDays(today, 180) };
}
export function validateRequestDate(value: string, now = new Date()) {
  const { minimum, maximum } = requestDateLimits(now);
  return value >= minimum && value <= maximum;
}
export const committedStatuses: RequestStatus[] = [
  'approved',
  'ordered',
  'in_transit',
  'delivered',
  'completed',
];
export function researchUsed(data: DemoSnapshot, id: string) {
  return data.requests
    .filter(
      (request) =>
        !request.deleted && request.researchId === id && committedStatuses.includes(request.status),
    )
    .reduce((sum, request) => sum.plus(requestTotal(request)), new Decimal(0));
}
