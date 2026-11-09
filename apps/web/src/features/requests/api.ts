import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api-client';
import { clientEnvironment } from '@/lib/environment';
import { requestSchema, userSchema } from '../demo/model';
import type {
  DemoRequest,
  DemoUser,
  ReplacementInput,
  RequestInput,
  RequestStatus,
  SubmissionStatus,
} from '../demo/model';

export const apiNotificationSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  requestId: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type ApiNotification = z.infer<typeof apiNotificationSchema>;

const apiRequestSingleResponseSchema = z.object({
  data: requestSchema,
});

const apiRequestListResponseSchema = z.object({
  data: z.array(requestSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    participants: z.array(userSchema),
    notifications: z.array(apiNotificationSchema),
  }),
});

export type ApiRequestListResponse = z.infer<typeof apiRequestListResponseSchema>;

export interface CreatePurchaseRequestPayload extends RequestInput {
  rabDocumentId?: string | null;
  rabItemId?: string | null;
}

export interface UpdatePurchaseRequestPayload extends RequestInput {
  expectedRevision?: number | undefined;
}

export async function fetchRequestsApi(): Promise<{
  requests: DemoRequest[];
  participants: DemoUser[];
  notifications: ApiNotification[];
}> {
  const raw = await apiRequest<unknown>('/requests', { method: 'GET' });
  const parsed = apiRequestListResponseSchema.parse(raw);
  return {
    requests: parsed.data,
    participants: parsed.meta.participants,
    notifications: parsed.meta.notifications,
  };
}

export async function fetchRequestByIdApi(id: string): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(`/requests/${encodeURIComponent(id)}`, { method: 'GET' });
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function createRequestApi(payload: CreatePurchaseRequestPayload): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>('/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function updateRequestApi(
  id: string,
  payload: UpdatePurchaseRequestPayload,
): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(`/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function deleteRequestApi(id: string, expectedRevision?: number): Promise<void> {
  await apiRequest<unknown>(`/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify(
      expectedRevision !== undefined ? { expectedRevision } : {},
    ),
  });
}

export async function cancelRequestApi(
  id: string,
  expectedRevision?: number,
): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(`/requests/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(
      expectedRevision !== undefined ? { expectedRevision } : {},
    ),
  });
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function updateSubmissionStatusApi(
  id: string,
  payload: {
    expectedStatus: SubmissionStatus;
    expectedRevision?: number | undefined;
    nextStatus: SubmissionStatus;
  },
): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(
    `/requests/${encodeURIComponent(id)}/submission-status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        expectedStatus: payload.expectedStatus,
        nextStatus: payload.nextStatus,
        ...(payload.expectedRevision !== undefined
          ? { expectedRevision: payload.expectedRevision }
          : {}),
      }),
    },
  );
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function changeRequestStatusApi(
  id: string,
  payload: {
    expectedStatus: RequestStatus;
    expectedRevision?: number | undefined;
    nextStatus: RequestStatus;
    reason?: string | undefined;
  },
): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(`/requests/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({
      expectedStatus: payload.expectedStatus,
      nextStatus: payload.nextStatus,
      reason: payload.reason ?? '',
      ...(payload.expectedRevision !== undefined
        ? { expectedRevision: payload.expectedRevision }
        : {}),
    }),
  });
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function saveInvoiceApi(
  id: string,
  payload: {
    number: string;
    amount: string;
    invoiceDate: string;
    url: string;
    file?: File | undefined;
    expectedUpdatedAt: string | null;
    expectedRevision?: number | undefined;
  },
): Promise<DemoRequest> {
  const formData = new FormData();
  formData.append('number', payload.number);
  formData.append('amount', payload.amount);
  formData.append('invoiceDate', payload.invoiceDate);
  formData.append('url', payload.url);
  if (payload.expectedUpdatedAt !== null) {
    formData.append('expectedUpdatedAt', payload.expectedUpdatedAt);
  }
  if (payload.expectedRevision !== undefined) {
    formData.append('expectedRevision', String(payload.expectedRevision));
  }
  if (payload.file) {
    formData.append('file', payload.file);
  }

  const base = clientEnvironment.apiBaseUrl.replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/requests/${encodeURIComponent(id)}/invoice`, {
      method: 'PUT',
      body: formData,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server API. Pastikan backend sedang berjalan.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : `Permintaan gagal (${String(response.status)}).`;
    throw new ApiError(response.status, message);
  }

  return apiRequestSingleResponseSchema.parse(body).data;
}

export async function downloadInvoiceFileApi(id: string): Promise<Blob> {
  const base = clientEnvironment.apiBaseUrl.replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/requests/${encodeURIComponent(id)}/invoice/file`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat mengunduh file invoice dari server.');
  }

  if (!response.ok) {
    throw new ApiError(response.status, 'File invoice tidak tersedia.');
  }

  return response.blob();
}

export async function proposeReplacementApi(
  id: string,
  payload: ReplacementInput & { expectedRevision: number },
): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(`/requests/${encodeURIComponent(id)}/replacements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function respondReplacementApi(
  id: string,
  proposalId: string,
  payload: {
    decision: 'accepted' | 'rejected';
    response?: string;
    expectedRevision: number;
  },
): Promise<DemoRequest> {
  const raw = await apiRequest<unknown>(
    `/requests/${encodeURIComponent(id)}/replacements/${encodeURIComponent(proposalId)}/respond`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: payload.decision,
        response: payload.response ?? '',
        expectedRevision: payload.expectedRevision,
      }),
    },
  );
  return apiRequestSingleResponseSchema.parse(raw).data;
}

export async function markNotificationsReadApi(ids?: string[]): Promise<void> {
  await apiRequest<unknown>('/requests/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  });
}

export interface ImportRequestRowPayload {
  item: string;
  quantity: number;
  unitPrice: string;
  date: string;
  url?: string;
  completed: boolean;
  invoiceAmount?: string | null;
  invoiceUrl?: string;
  notes?: string;
}

export interface ImportRequestsPayload {
  researchId: string;
  sourceName?: string;
  rows: ImportRequestRowPayload[];
}

export interface ImportRequestsResult {
  created: number;
  completed: number;
  pending: number;
  total: string;
  warnings: string[];
}

const importRequestsResponseSchema = z.object({
  data: z.object({
    created: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    total: z.string(),
    warnings: z.array(z.string()),
  }),
});

export async function importRequestsApi(
  payload: ImportRequestsPayload,
): Promise<ImportRequestsResult> {
  const raw = await apiRequest<unknown>('/requests/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return importRequestsResponseSchema.parse(raw).data;
}
