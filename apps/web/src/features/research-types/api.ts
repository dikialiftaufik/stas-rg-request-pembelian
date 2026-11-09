import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
import { moneySchema, roleSchema } from '../demo/model';
import type { DemoUser, ResearchInput } from '../demo/model';

const apiAuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  email: z.email(),
  role: roleSchema,
  researchIds: z.array(z.string()).optional().default([]),
  createdAt: z.iso.datetime(),
});

const apiAuthResponseSchema = z.object({
  data: z.object({
    user: apiAuthUserSchema,
  }),
});

export const apiResearchTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  allocated: moneySchema,
  committed: moneySchema,
  remaining: z.string(),
  requestCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const apiResearchSingleResponseSchema = z.object({
  data: apiResearchTypeSchema,
});

const apiResearchListResponseSchema = z.object({
  data: z.array(apiResearchTypeSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    summary: z.object({
      totalAllocated: moneySchema,
      totalCommitted: moneySchema,
      totalRemaining: z.string(),
    }),
  }),
});

export type ApiResearchType = z.infer<typeof apiResearchTypeSchema>;
export type ApiResearchListResponse = z.infer<typeof apiResearchListResponseSchema>;

function toDemoUser(user: z.infer<typeof apiAuthUserSchema>): DemoUser {
  return {
    ...user,
    researchIds: [...user.researchIds],
  };
}

export async function loginUserApi(identifier: string, password: string): Promise<DemoUser> {
  const raw = await apiRequest<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  const parsed = apiAuthResponseSchema.parse(raw);
  return toDemoUser(parsed.data.user);
}

export async function fetchCurrentSessionApi(): Promise<DemoUser> {
  const raw = await apiRequest<unknown>('/auth/me', {
    method: 'GET',
  });
  const parsed = apiAuthResponseSchema.parse(raw);
  return toDemoUser(parsed.data.user);
}

export async function logoutUserApi(): Promise<void> {
  await apiRequest<unknown>('/auth/logout', {
    method: 'POST',
  });
}

export async function loginAdminApi(email: string, password: string): Promise<DemoUser> {
  const raw = await apiRequest<unknown>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const parsed = apiAuthResponseSchema.parse(raw);
  return toDemoUser(parsed.data.user);
}

export async function fetchAdminSessionApi(): Promise<DemoUser> {
  const raw = await apiRequest<unknown>('/auth/admin/me', {
    method: 'GET',
  });
  const parsed = apiAuthResponseSchema.parse(raw);
  return toDemoUser(parsed.data.user);
}

export async function logoutAdminApi(): Promise<void> {
  await apiRequest<unknown>('/auth/admin/logout', {
    method: 'POST',
  });
}

export async function fetchResearchTypesApi(query?: string): Promise<ApiResearchListResponse> {
  const trimmed = query?.trim() ?? '';
  const search = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
  const raw = await apiRequest<unknown>(`/research-types${search}`, {
    method: 'GET',
  });
  return apiResearchListResponseSchema.parse(raw);
}

export async function fetchResearchTypeByIdApi(id: string): Promise<ApiResearchType> {
  const raw = await apiRequest<unknown>(`/research-types/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  return apiResearchSingleResponseSchema.parse(raw).data;
}

export async function createResearchTypeApi(input: ResearchInput): Promise<ApiResearchType> {
  const raw = await apiRequest<unknown>('/research-types', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return apiResearchSingleResponseSchema.parse(raw).data;
}

export async function updateResearchTypeApi(
  id: string,
  input: ResearchInput,
): Promise<ApiResearchType> {
  const raw = await apiRequest<unknown>(`/research-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return apiResearchSingleResponseSchema.parse(raw).data;
}

export async function deleteResearchTypeApi(id: string): Promise<void> {
  await apiRequest<unknown>(`/research-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
