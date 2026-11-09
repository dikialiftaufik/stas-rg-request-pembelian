import { clientEnvironment } from './environment';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const rawMessage = (payload as { message?: unknown }).message;
    if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
      return rawMessage;
    }
    if (Array.isArray(rawMessage) && typeof rawMessage[0] === 'string') {
      return rawMessage[0];
    }
  }
  return fallback;
}

export async function apiRequest<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const base = clientEnvironment.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${base}${normalizedPath}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server API. Pastikan backend sedang berjalan.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractErrorMessage(body, `Permintaan gagal (${String(response.status)}).`),
    );
  }

  return body as TResponse;
}
