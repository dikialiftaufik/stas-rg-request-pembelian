import { z } from 'zod';

const roleSchema = z.enum(['admin', 'pengaju'], {
  error: 'Peran harus Admin atau Pengaju.',
});

const nameSchema = z
  .string({ error: 'Nama wajib diisi.' })
  .trim()
  .min(1, 'Nama wajib diisi.')
  .max(150, 'Nama maksimal 150 karakter.');

const identifierSchema = z
  .string({ error: 'NIP/NIM wajib diisi.' })
  .trim()
  .min(1, 'NIP/NIM wajib diisi.')
  .max(50, 'NIP/NIM maksimal 50 karakter.');

const emailSchema = z
  .string({ error: 'Email wajib diisi.' })
  .trim()
  .min(1, 'Email wajib diisi.')
  .toLowerCase()
  .pipe(z.email('Format email tidak valid.'));

/** bcrypt hanya memproses 72 byte pertama, sehingga batas atas dikunci di 72 karakter. */
export const passwordSchema = z
  .string({ error: 'Password wajib diisi.' })
  .min(8, 'Password minimal 8 karakter.')
  .max(72, 'Password maksimal 72 karakter.');

const researchIdsSchema = z
  .array(z.string().trim().min(1, 'ID riset tidak valid.'), {
    error: 'Perwakilan riset harus berupa daftar.',
  })
  .max(20, 'Perwakilan riset terlalu banyak.')
  .transform((ids) => [...new Set(ids)]);

export const createUserSchema = z.strictObject({
  name: nameSchema,
  identifier: identifierSchema,
  email: emailSchema,
  role: roleSchema,
  password: passwordSchema,
  isActive: z.boolean({ error: 'Status aktif harus berupa boolean.' }).optional().default(true),
  researchIds: researchIdsSchema.optional().default([]),
});

export const updateUserSchema = z
  .strictObject({
    name: nameSchema.optional(),
    identifier: identifierSchema.optional(),
    email: emailSchema.optional(),
    role: roleSchema.optional(),
    password: passwordSchema.optional(),
    isActive: z.boolean({ error: 'Status aktif harus berupa boolean.' }).optional(),
    researchIds: researchIdsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Minimal satu field perubahan harus dikirim.',
  });

export const listUsersQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(200, 'Kata kunci pencarian maksimal 200 karakter.')
    .optional()
    .default(''),
  role: roleSchema.optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
