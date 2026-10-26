import { z } from 'zod';

const environmentSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .default('/api/v1')
    .refine((value) => {
      if (value.startsWith('/') && !value.startsWith('//')) return true;
      try {
        const url = new URL(value);
        return (
          url.protocol === 'https:' ||
          (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
        );
      } catch {
        return false;
      }
    }, 'API harus berupa path relatif, HTTPS, atau HTTP localhost.'),
  VITE_ENABLE_MOCKS: z.enum(['true', 'false']).default('false'),
});

export function parseClientEnvironment(values: Record<string, unknown>) {
  const parsed = environmentSchema.parse(values);
  return { apiBaseUrl: parsed.VITE_API_BASE_URL, enableMocks: parsed.VITE_ENABLE_MOCKS === 'true' };
}

export const clientEnvironment = parseClientEnvironment(import.meta.env);
