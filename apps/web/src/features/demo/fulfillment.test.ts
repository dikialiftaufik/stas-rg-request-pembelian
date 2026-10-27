import { describe, expect, it, vi } from 'vitest';
import {
  loginDemo,
  saveFulfillment,
  getSnapshot,
  visibleRequest,
  reloadDemoState,
  saveInvoice,
  changeRequestStatus,
  DEMO_STORAGE_KEY,
  logoutDemo,
  deleteRequest,
} from './store';
const values = {
  supplier: 'Supplier STAS',
  courier: 'Kurir contoh',
  trackingNumber: '00123',
  estimatedArrival: '2026-11-15',
  notes: 'Hubungi penanggung jawab saat tiba.',
};
describe('invoice metadata and fulfillment', () => {
  it('persists shipping without advancing status and rejects stale or unauthorized changes', () => {
    loginDemo('admin@gmail.com', 'admin123');
    const before = visibleRequest('request-2');
    saveFulfillment({ requestId: before.id, values, expectedUpdatedAt: null });
    const saved = visibleRequest(before.id);
    expect(saved.status).toBe(before.status);
    expect(saved.statusHistory).toEqual(before.statusHistory);
    expect(saved.fulfillment).toMatchObject({ ...values, updatedBy: 'demo-admin' });
    expect(getSnapshot().notifications[0]?.recipientId).toBe(saved.ownerId);
    reloadDemoState();
    expect(visibleRequest(before.id).fulfillment?.trackingNumber).toBe('00123');
    expect(() =>
      saveFulfillment({ requestId: before.id, values, expectedUpdatedAt: null }),
    ).toThrow(/sudah berubah/);
    expect(() =>
      saveFulfillment({ requestId: 'request-1', values, expectedUpdatedAt: null }),
    ).toThrow(/disetujui/);
    deleteRequest(before.id);
    expect(() =>
      saveFulfillment({ requestId: before.id, values, expectedUpdatedAt: null }),
    ).toThrow(/tidak ditemukan/);
    logoutDemo();
    loginDemo('pengaju@gmail.com', 'pengaju123');
    expect(() =>
      saveFulfillment({ requestId: 'request-1', values, expectedUpdatedAt: null }),
    ).toThrow(/akses/);
  });
  it('rolls back failed shipping persistence and rejects invalid dates', () => {
    loginDemo('admin@gmail.com', 'admin123');
    const before = JSON.stringify(getSnapshot());
    expect(() =>
      saveFulfillment({
        requestId: 'request-2',
        values: { ...values, estimatedArrival: '2026-02-30' },
        expectedUpdatedAt: null,
      }),
    ).toThrow();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota');
    });
    expect(() =>
      saveFulfillment({ requestId: 'request-2', values, expectedUpdatedAt: null }),
    ).toThrow(/gagal disimpan/);
    spy.mockRestore();
    expect(JSON.stringify(getSnapshot())).toBe(before);
  });
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
