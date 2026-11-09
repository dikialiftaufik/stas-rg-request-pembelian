import { z } from 'zod';

export const adminLoginSchema = z.strictObject({
  email: z
    .string({ error: 'Email wajib diisi.' })
    .trim()
    .min(1, 'Email wajib diisi.')
    .toLowerCase()
    .pipe(z.email('Format email tidak valid.')),
  password: z
    .string({ error: 'Password wajib diisi.' })
    .min(1, 'Password wajib diisi.')
    .max(256, 'Password maksimal 256 karakter.'),
});

export type AdminLoginDto = z.infer<typeof adminLoginSchema>;
