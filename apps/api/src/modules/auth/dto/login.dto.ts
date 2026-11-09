import { z } from 'zod';

export const loginSchema = z.strictObject({
  identifier: z
    .string({ error: 'ID, NIP/NIM, atau email wajib diisi.' })
    .trim()
    .min(1, 'ID, NIP/NIM, atau email wajib diisi.')
    .max(254, 'Identitas maksimal 254 karakter.'),
  password: z
    .string({ error: 'Password wajib diisi.' })
    .min(1, 'Password wajib diisi.')
    .max(256, 'Password maksimal 256 karakter.'),
});

export type LoginDto = z.infer<typeof loginSchema>;
