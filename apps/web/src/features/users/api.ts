import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
import { roleSchema } from '../demo/model';

export const apiUserAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  email: z.email(),
  role: roleSchema,
  isActive: z.boolean(),
  researchIds: z.array(z.string()),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const apiUserSingleResponseSchema = z.object({
  data: apiUserAccountSchema,
});

const apiUserListResponseSchema = z.object({
  data: z.array(apiUserAccountSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    summary: z.object({
      totalAdmins: z.number().int().nonnegative(),
      totalPengaju: z.number().int().nonnegative(),
      totalInactive: z.number().int().nonnegative(),
    }),
  }),
});

export type ApiUserAccount = z.infer<typeof apiUserAccountSchema>;
export type ApiUserListResponse = z.infer<typeof apiUserListResponseSchema>;

/**
 * Skema form akun. Password wajib saat membuat akun dan opsional saat mengedit
 * (dikosongkan berarti password lama tetap dipakai).
 */
export function accountFormSchema(mode: 'create' | 'edit') {
  return z
    .object({
      name: z.string().trim().min(1, 'Nama wajib diisi.').max(150, 'Nama maksimal 150 karakter.'),
      identifier: z
        .string()
        .trim()
        .min(1, 'NIP/NIM wajib diisi.')
        .max(50, 'NIP/NIM maksimal 50 karakter.'),
      email: z
        .string()
        .trim()
        .pipe(z.email('Email tidak valid.'))
        .transform((value) => value.toLowerCase()),
      role: roleSchema,
      isActive: z.boolean(),
      researchIds: z.array(z.string()),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((value, context) => {
      if (value.role === 'pengaju' && value.researchIds.length !== 1) {
        context.addIssue({
          code: 'custom',
          message: 'Pilih tepat satu riset yang diwakili Pengaju.',
          path: ['researchIds'],
        });
      }
      const passwordRequired = mode === 'create' || value.password.length > 0;
      if (passwordRequired && value.password.length < 8) {
        context.addIssue({
          code: 'custom',
          message: 'Password minimal 8 karakter.',
          path: ['password'],
        });
      }
      if (value.password.length > 72) {
        context.addIssue({
          code: 'custom',
          message: 'Password maksimal 72 karakter.',
          path: ['password'],
        });
      }
      if (value.password !== value.confirmPassword) {
        context.addIssue({
          code: 'custom',
          message: 'Konfirmasi password tidak sama.',
          path: ['confirmPassword'],
        });
      }
    });
}

export type AccountFormInput = z.input<ReturnType<typeof accountFormSchema>>;
export type AccountFormValues = z.output<ReturnType<typeof accountFormSchema>>;

/** Mengubah nilai form menjadi payload API (tanpa confirmPassword / password kosong). */
export function toAccountPayload(values: AccountFormValues) {
  return {
    name: values.name,
    identifier: values.identifier,
    email: values.email,
    role: values.role,
    isActive: values.isActive,
    researchIds: values.role === 'admin' ? [] : values.researchIds,
    ...(values.password ? { password: values.password } : {}),
  };
}

export type AccountPayload = ReturnType<typeof toAccountPayload>;

export async function fetchUsersApi(query?: string): Promise<ApiUserListResponse> {
  const trimmed = query?.trim() ?? '';
  const search = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
  const raw = await apiRequest<unknown>(`/users${search}`, { method: 'GET' });
  return apiUserListResponseSchema.parse(raw);
}

export async function fetchUserByIdApi(id: string): Promise<ApiUserAccount> {
  const raw = await apiRequest<unknown>(`/users/${encodeURIComponent(id)}`, { method: 'GET' });
  return apiUserSingleResponseSchema.parse(raw).data;
}

export async function createUserApi(payload: AccountPayload): Promise<ApiUserAccount> {
  const raw = await apiRequest<unknown>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return apiUserSingleResponseSchema.parse(raw).data;
}

export async function updateUserApi(
  id: string,
  payload: Partial<AccountPayload>,
): Promise<ApiUserAccount> {
  const raw = await apiRequest<unknown>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return apiUserSingleResponseSchema.parse(raw).data;
}

export async function deleteUserApi(id: string): Promise<void> {
  await apiRequest<unknown>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
