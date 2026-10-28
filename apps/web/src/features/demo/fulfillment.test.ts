import { describe, expect, it } from 'vitest';
import {
  loginDemo,
  getSnapshot,
  visibleRequest,
  reloadDemoState,
  saveInvoice,
  changeRequestStatus,
  DEMO_STORAGE_KEY,
} from './store';
describe('invoice metadata and legacy fulfillment', () => {
  it('validates actual invoice values and preserves legacy completed records', async () => {
    loginDemo('admin@gmail.com', 'admin123');
    const input = {
      requestId: 'request-2',
      url: 'https://example.test/invoice',
      expectedUpdatedAt: null,
      amount: '12000000.25',
      number: 'INV/2026/001',
      invoiceDate: '2026-01-01',
    };
    await expect(saveInvoice({ ...input, amount: '0' })).rejects.toThrow();
    const before = JSON.stringify(getSnapshot());
    for (const number of ['', '   ', '1'.repeat(121)])
      await expect(saveInvoice({ ...input, number })).rejects.toThrow(/invoice/);
    expect(JSON.stringify(getSnapshot())).toBe(before);
    await expect(saveInvoice({ ...input, invoiceDate: '2999-01-01' })).rejects.toThrow(/hari ini/);
    await saveInvoice({ ...input, number: '  000123/INV  ' });
    expect(visibleRequest('request-2').invoice).toMatchObject({
      amount: '12000000.25',
      number: '000123/INV',
      invoiceDate: '2026-01-01',
    });
    const snapshot = getSnapshot();
    sessionStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        requests: snapshot.requests.map((row) =>
          row.id === input.requestId
            ? {
                ...row,
                status: 'completed',
                fulfillment: undefined,
                invoice: {
                  ...row.invoice,
                  number: undefined,
                  amount: undefined,
                  invoiceDate: undefined,
                },
              }
            : row,
        ),
      }),
    );
    reloadDemoState();
    expect(visibleRequest(input.requestId)).toMatchObject({
      status: 'completed',
      fulfillment: null,
      invoice: { number: null, amount: null, invoiceDate: null },
    });
    sessionStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        ...getSnapshot(),
        requests: getSnapshot().requests.map((row) =>
          row.id === input.requestId ? { ...row, status: 'delivered' } : row,
        ),
      }),
    );
    reloadDemoState();
    await expect(
      changeRequestStatus({
        id: input.requestId,
        expectedStatus: 'delivered',
        nextStatus: 'completed',
      }),
    ).rejects.toThrow(/invoice/);
    expect(visibleRequest(input.requestId).status).toBe('delivered');
  });
});
