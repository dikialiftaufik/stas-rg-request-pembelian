import Decimal from 'decimal.js';
import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'pengaju']);
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
  .refine((value) => value.role === 'admin' || value.researchIds.length > 0, {
    message: 'Pilih minimal satu jenis riset untuk Pengaju.',
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
export const requestInputSchema = z.object({
  item: z.string().trim().min(1, 'Nama barang wajib diisi.'),
  researchId: z.string().min(1, 'Pilih jenis riset.'),
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
export const requestSchema = requestInputSchema.extend({
  id: z.string(),
  ownerId: z.string(),
  status: statusSchema,
  createdAt: z.iso.datetime(),
  deleted: z.boolean(),
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
    accountId: z.enum(['demo-admin', 'demo-pengaju']).nullable(),
    users: z.array(userSchema),
    research: z.array(researchSchema),
    requests: z.array(requestSchema),
    notifications: z.array(notificationSchema),
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
      users.size !== value.users.length ||
      research.size !== value.research.length
    ) {
      context.addIssue({ code: 'custom', message: 'Data demo tidak konsisten.' });
    }
  });

export type DemoRole = z.infer<typeof roleSchema>;
export type RequestStatus = z.infer<typeof statusSchema>;
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
    month: 'numeric',
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
