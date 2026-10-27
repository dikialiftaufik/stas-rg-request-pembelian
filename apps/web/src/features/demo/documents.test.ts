import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSnapshot,
  loginDemo,
  logoutDemo,
  reloadDemoState,
  saveInvoice,
  loadInvoiceFile,
  visibleRequest,
  changeRequestStatus,
  deleteRequest,
  DEMO_STORAGE_KEY,
  resetDemoState,
} from './store';
import type { AttachmentRef } from './model';
const blobs = vi.hoisted(() => {
  vi.resetModules();
  return new Map<string, Blob>();
});
vi.mock('./attachment-db', () => ({
  putAttachment: vi.fn((file: File, mime: string, uploadedBy: string) => {
    const ref = {
      id: crypto.randomUUID(),
      sessionId: 'tab',
      name: file.name,
      mime,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    };
    blobs.set(ref.id, file);
    return Promise.resolve(ref);
  }),
  getAttachment: vi.fn((ref: AttachmentRef) => {
    const file = blobs.get(ref.id);
    return file
      ? Promise.resolve(file)
      : Promise.reject(new Error('File tidak tersedia. Unggah kembali.'));
  }),
  removeAttachment: vi.fn((ref: AttachmentRef) => {
    blobs.delete(ref.id);
    return Promise.resolve();
  }),
}));
vi.mock('./file-validation', () => ({
  validateFile: vi.fn((file: File) =>
    Promise.resolve(file.name.endsWith('.csv') ? 'text/csv' : 'image/png'),
  ),
}));
import { getAttachment, putAttachment } from './attachment-db';
const admin = () => loginDemo('admin@gmail.com', 'admin123');
const file = () => new File(['data'], 'invoice.png', { type: 'image/png' });
beforeEach(() => {
  resetDemoState();
  blobs.clear();
  vi.clearAllMocks();
});
describe('invoice documents and permissions', () => {
  it('memeriksa ulang request setelah menunggu pembacaan file', async () => {
    admin();
    await changeRequestStatus({
      id: 'request-1',
      expectedStatus: 'pending_review',
      nextStatus: 'approved',
    });
    await saveInvoice({
      amount: '100000',
      invoiceDate: '2026-01-01',
      requestId: 'request-1',
      file: file(),
      url: '',
      expectedUpdatedAt: null,
    });
    for (const nextStatus of ['ordered', 'in_transit', 'delivered'] as const)
      await changeRequestStatus({
        id: 'request-1',
        expectedStatus: visibleRequest('request-1').status,
        nextStatus,
      });
    let release: ((blob: Blob) => void) | undefined;
    vi.mocked(getAttachment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = changeRequestStatus({
      id: 'request-1',
      expectedStatus: 'delivered',
      nextStatus: 'completed',
    });
    deleteRequest('request-1');
    const afterDelete = JSON.stringify(getSnapshot());
    release?.(file());
    await expect(pending).rejects.toThrow(/tidak ditemukan|tidak dapat diakses/);
    expect(JSON.stringify(getSnapshot())).toBe(afterDelete);
  });
  it('menjaga invoice saat penggantian gagal, memulihkan setelah refresh dan memeriksa file sebelum selesai', async () => {
    admin();
    await changeRequestStatus({
      id: 'request-1',
      expectedStatus: 'pending_review',
      nextStatus: 'approved',
    });
    await saveInvoice({
      amount: '100000',
      invoiceDate: '2026-01-01',
      requestId: 'request-1',
      file: file(),
      url: '',
      expectedUpdatedAt: null,
    });
    const original = visibleRequest('request-1').invoice;
    vi.mocked(putAttachment).mockRejectedValueOnce(new Error('Storage penuh'));
    await expect(
      saveInvoice({
        amount: '100000',
        invoiceDate: '2026-01-01',
        requestId: 'request-1',
        file: file(),
        url: '',
        expectedUpdatedAt: original?.updatedAt ?? null,
      }),
    ).rejects.toThrow(/Storage/);
    expect(visibleRequest('request-1').invoice).toEqual(original);
    reloadDemoState();
    expect((await loadInvoiceFile('request-1')).size).toBe(4);
    for (const nextStatus of ['ordered', 'in_transit', 'delivered'] as const)
      await changeRequestStatus({
        id: 'request-1',
        expectedStatus: visibleRequest('request-1').status,
        nextStatus,
      });
    blobs.clear();
    await expect(
      changeRequestStatus({
        id: 'request-1',
        expectedStatus: 'delivered',
        nextStatus: 'completed',
      }),
    ).rejects.toThrow(/File tidak tersedia/);
    expect(visibleRequest('request-1').status).toBe('delivered');
    await saveInvoice({
      amount: '100000',
      invoiceDate: '2026-01-01',
      requestId: 'request-1',
      file: file(),
      url: 'https://example.test/invoice',
      expectedUpdatedAt: original?.updatedAt ?? null,
    });
    await changeRequestStatus({
      id: 'request-1',
      expectedStatus: 'delivered',
      nextStatus: 'completed',
    });
    expect(visibleRequest('request-1').status).toBe('completed');
  });
  it('memblokir invoice sebelum disetujui, URL tidak aman, Pengaju dan request terhapus', async () => {
    admin();
    await expect(
      saveInvoice({
        amount: '100000',
        invoiceDate: '2026-01-01',
        requestId: 'request-1',
        url: 'https://example.test',
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow(/disetujui/);
    await expect(
      saveInvoice({
        amount: '100000',
        invoiceDate: '2026-01-01',
        requestId: 'request-5',
        url: 'javascript:alert(1)',
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow();
    await expect(
      changeRequestStatus({ id: 'request-5', expectedStatus: 'approved', nextStatus: 'completed' }),
    ).rejects.toThrow();
    deleteRequest('request-5');
    await expect(
      saveInvoice({
        amount: '100000',
        invoiceDate: '2026-01-01',
        requestId: 'request-5',
        url: 'https://example.test',
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow();
    logoutDemo();
    loginDemo('pengaju@gmail.com', 'pengaju123');
    await expect(
      saveInvoice({
        amount: '100000',
        invoiceDate: '2026-01-01',
        requestId: 'request-1',
        file: file(),
        url: '',
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow(/akses/);
  });
  it('snapshot lama mendapat default invoice, satuan dan RAB tanpa kehilangan data', () => {
    const data = getSnapshot();
    sessionStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        ...data,
        rabDocuments: undefined,
        requests: data.requests.map((request) => ({
          ...request,
          invoice: undefined,
          unit: undefined,
          rabDocumentId: undefined,
          rabItemId: undefined,
        })),
      }),
    );
    reloadDemoState();
    expect(getSnapshot().requests[0]).toMatchObject({
      invoice: null,
      unit: 'unit',
      rabDocumentId: null,
      rabItemId: null,
    });
    expect(getSnapshot().rabDocuments).toEqual([]);
  });
});
