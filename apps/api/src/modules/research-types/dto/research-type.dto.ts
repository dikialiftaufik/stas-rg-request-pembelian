import { Prisma } from '@prisma/client';
import { z } from 'zod';

const MAX_ALLOCATED_DECIMAL = new Prisma.Decimal('9999999999999999.99');

export const moneyStringSchema = z
  .string({ error: 'Nominal alokasi wajib diisi.' })
  .trim()
  .refine((value) => {
    const [integer, fraction, ...extra] = value.split('.');
    if (extra.length > 0 || !/^\d+$/.test(integer ?? '')) {
      return false;
    }
    if (fraction !== undefined && !/^\d{1,2}$/.test(fraction)) {
      return false;
    }
    try {
      const decimal = new Prisma.Decimal(value);
      return decimal.isFinite();
    } catch {
      return false;
    }
  }, 'Masukkan nominal yang valid.');

export const positiveAllocatedSchema = moneyStringSchema
  .refine((value) => new Prisma.Decimal(value).gt(0), 'Nominal harus lebih dari nol.')
  .refine(
    (value) => new Prisma.Decimal(value).lte(MAX_ALLOCATED_DECIMAL),
    'Nominal alokasi melebihi batas maksimum yang diizinkan.',
  );

export const createResearchTypeSchema = z.strictObject({
  name: z
    .string({ error: 'Nama riset wajib diisi.' })
    .trim()
    .min(1, 'Nama riset wajib diisi.')
    .max(150, 'Nama riset maksimal 150 karakter.'),
  description: z
    .string({ error: 'Deskripsi harus berupa teks.' })
    .trim()
    .max(2000, 'Deskripsi maksimal 2.000 karakter.')
    .optional()
    .default(''),
  allocated: positiveAllocatedSchema,
});

export const updateResearchTypeSchema = z
  .strictObject({
    name: z
      .string({ error: 'Nama riset harus berupa teks.' })
      .trim()
      .min(1, 'Nama riset wajib diisi.')
      .max(150, 'Nama riset maksimal 150 karakter.')
      .optional(),
    description: z
      .string({ error: 'Deskripsi harus berupa teks.' })
      .trim()
      .max(2000, 'Deskripsi maksimal 2.000 karakter.')
      .optional(),
    allocated: positiveAllocatedSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined || value.allocated !== undefined,
    { message: 'Minimal satu field perubahan harus dikirim.' },
  );

export const listResearchTypesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200, 'Kata kunci pencarian maksimal 200 karakter.')
    .optional()
    .default(''),
});

export type CreateResearchTypeDto = z.infer<typeof createResearchTypeSchema>;
export type UpdateResearchTypeDto = z.infer<typeof updateResearchTypeSchema>;
export type ListResearchTypesQueryDto = z.infer<typeof listResearchTypesQuerySchema>;
