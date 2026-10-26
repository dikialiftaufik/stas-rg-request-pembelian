import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

describe('API tiruan untuk pengembangan', () => {
  it('memberi label mock dengan jelas dan tidak mengklaim backend tersambung', async () => {
    const response = await fetch('http://localhost/api/v1/setup');
    const body: unknown = await response.json();
    expect(response.ok).toBe(true);
    expect(body).toEqual({ data: { mode: 'mock', backendConnected: false } });
  });
});
