import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { positiveAllocatedSchema } from '../../research-types/dto/research-type.dto';

export const requestStatusSchema = z.enum([
  'pending_review',
  'approved',
  'ordered',
  'in_transit',
  'delivered',
  'completed',
  'rejected',
  'cancelled',
]);

export const submissionStatusSchema = z.enum(['not_submitted', 'submitted']);

const isoDateSchema = z
  .string({ error: 'Tanggal wajib diisi.' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.');

export const httpUrlOrEmptySchema = z
  .string()
  .trim()
  .max(2048, 'Tautan terlalu panjang.')
  .refine((value) => {
    if (!value) return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Gunakan tautan HTTP atau HTTPS yang lengkap.');

const positiveUnitPriceSchema = positiveAllocatedSchema.refine(
  (value) => new Prisma.Decimal(value).gt(0),
  'Harga satuan harus lebih dari nol.',
);

export const createPurchaseRequestSchema = z.strictObject({
  item: z
    .string({ error: 'Nama barang wajib diisi.' })
    .trim()
    .min(1, 'Nama barang wajib diisi.')
    .max(250, 'Nama barang maksimal 250 karakter.'),
  unit: z
    .string({ error: 'Satuan wajib diisi.' })
    .trim()
    .min(1, 'Satuan wajib diisi.')
    .max(60, 'Satuan maksimal 60 karakter.')
    .default('unit'),
  researchId: z
    .string({ error: 'Riset perwakilan belum tersedia.' })
    .trim()
    .min(1, 'Riset perwakilan belum tersedia. Hubungi Admin.'),
  quantity: z
    .number({ error: 'Jumlah wajib diisi.' })
    .int('Jumlah harus bilangan bulat.')
    .min(1, 'Jumlah minimal satu.')
    .max(1_000_000, 'Jumlah melebihi batas maksimum.'),
  unitPrice: positiveUnitPriceSchema,
  requiredDate: isoDateSchema,
  url: httpUrlOrEmptySchema.optional().default(''),
  notes: z.string().trim().max(4000, 'Catatan maksimal 4.000 karakter.').optional().default(''),
  rabDocumentId: z.string().trim().min(1).nullable().optional().default(null),
  rabItemId: z.string().trim().min(1).nullable().optional().default(null),
});

export const updatePurchaseRequestSchema = z.strictObject({
  item: z.string().trim().min(1, 'Nama barang wajib diisi.').max(250),
  unit: z.string().trim().min(1, 'Satuan wajib diisi.').max(60),
  researchId: z.string().trim().min(1, 'Riset wajib dipilih.'),
  quantity: z.number().int('Jumlah harus bilangan bulat.').min(1, 'Jumlah minimal satu.').max(1_000_000),
  unitPrice: positiveUnitPriceSchema,
  requiredDate: isoDateSchema,
  url: httpUrlOrEmptySchema.optional().default(''),
  notes: z.string().trim().max(4000).optional().default(''),
  expectedRevision: z.number().int().nonnegative().optional(),
});

export const revisionBodySchema = z
  .strictObject({
    expectedRevision: z.number().int().nonnegative().optional(),
  })
  .optional()
  .default({});

export const updateSubmissionStatusSchema = z.strictObject({
  expectedStatus: submissionStatusSchema,
  expectedRevision: z.number().int().nonnegative().optional(),
  nextStatus: submissionStatusSchema,
});

export const changeRequestStatusSchema = z
  .strictObject({
    expectedStatus: requestStatusSchema,
    expectedRevision: z.number().int().nonnegative().optional(),
    nextStatus: requestStatusSchema,
    reason: z.string().trim().max(2000).optional().default(''),
  })
  .refine((value) => value.nextStatus !== 'rejected' || value.reason.length > 0, {
    path: ['reason'],
    message: 'Jelaskan alasan penolakan agar Pengaju dapat menindaklanjuti.',
  });

export const saveInvoiceMetadataSchema = z.object({
  number: z
    .string({ error: 'Nomor invoice wajib diisi.' })
    .trim()
    .min(1, 'Nomor invoice wajib diisi.')
    .max(120, 'Nomor invoice maksimal 120 karakter.'),
  amount: positiveUnitPriceSchema,
  invoiceDate: isoDateSchema,
  url: httpUrlOrEmptySchema.optional().default(''),
  expectedUpdatedAt: z.string().trim().nullable().optional().default(null),
  expectedRevision: z.coerce.number().int().nonnegative().optional(),
});

export const proposeReplacementSchema = z.strictObject({
  url: httpUrlOrEmptySchema.refine(Boolean, 'Tautan pengganti wajib diisi.'),
  unitPrice: positiveUnitPriceSchema,
  reason: z
    .string({ error: 'Jelaskan alasan penggantian.' })
    .trim()
    .min(1, 'Jelaskan alasan penggantian.')
    .max(2000, 'Alasan maksimal 2.000 karakter.'),
  expectedRevision: z.number().int().nonnegative(),
});

export const respondReplacementSchema = z.strictObject({
  decision: z.enum(['accepted', 'rejected']),
  response: z.string().trim().max(2000).optional().default(''),
  expectedRevision: z.number().int().nonnegative(),
});

export const markNotificationsReadSchema = z.strictObject({
  ids: z.array(z.string().trim().min(1)).optional(),
});

export const MAX_IMPORT_ROWS = 1000;

const importRowSchema = z.strictObject({
  item: z
    .string({ error: 'Nama barang wajib diisi.' })
    .trim()
    .min(1, 'Nama barang wajib diisi.')
    .max(250, 'Nama barang maksimal 250 karakter.'),
  quantity: z
    .number({ error: 'Jumlah wajib diisi.' })
    .int('Jumlah harus bilangan bulat.')
    .min(1, 'Jumlah minimal satu.')
    .max(1_000_000, 'Jumlah melebihi batas maksimum.'),
  unitPrice: positiveUnitPriceSchema,
  date: isoDateSchema,
  url: httpUrlOrEmptySchema.optional().default(''),
  completed: z.boolean(),
  invoiceAmount: positiveUnitPriceSchema.nullable().optional().default(null),
  invoiceUrl: httpUrlOrEmptySchema.optional().default(''),
  notes: z.string().trim().max(4000, 'Catatan maksimal 4.000 karakter.').optional().default(''),
});

export const importPurchaseRequestsSchema = z.strictObject({
  researchId: z
    .string({ error: 'Pilih jenis riset tujuan.' })
    .trim()
    .min(1, 'Pilih jenis riset tujuan.'),
  sourceName: z.string().trim().max(250).optional().default(''),
  rows: z
    .array(importRowSchema)
    .min(1, 'Tidak ada baris valid untuk diimpor.')
    .max(MAX_IMPORT_ROWS, `Maksimal ${MAX_IMPORT_ROWS} baris per impor.`),
});

export type CreatePurchaseRequestDto = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestDto = z.infer<typeof updatePurchaseRequestSchema>;
export type UpdateSubmissionStatusDto = z.infer<typeof updateSubmissionStatusSchema>;
export type ChangeRequestStatusDto = z.infer<typeof changeRequestStatusSchema>;
export type SaveInvoiceMetadataDto = z.infer<typeof saveInvoiceMetadataSchema>;
export type ProposeReplacementDto = z.infer<typeof proposeReplacementSchema>;
export type RespondReplacementDto = z.infer<typeof respondReplacementSchema>;
export type MarkNotificationsReadDto = z.infer<typeof markNotificationsReadSchema>;
export type ImportPurchaseRequestsDto = z.infer<typeof importPurchaseRequestsSchema>;
