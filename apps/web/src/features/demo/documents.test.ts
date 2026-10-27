import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSnapshot,
  loginDemo,
  logoutDemo,
  reloadDemoState,
  saveInvoice,
  loadInvoiceFile,
  importRab,
  scopedRabs,
  visibleRab,
  saveRequest,
  visibleRequest,
  changeRequestStatus,
  deleteRequest,
  DEMO_STORAGE_KEY,
  resetDemoState,
  saveUser,
} from './store';
import { requestDateLimits } from './model';
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
const rab = () => ({
  researchId: 'smart',
  name: 'RAB Sensor',
  file: new File(['Barang,Jumlah,Harga\nSensor,2,100'], 'rab.csv'),
  items: [{ name: 'Sensor', quantity: 2, unit: 'set', unitPrice: '100', notes: '' }],
});
beforeEach(() => {
  resetDemoState();
  blobs.clear();
  vi.clearAllMocks();
});
describe('dokumen dan cakupan peran', () => {
  it('memeriksa ulang request setelah menunggu pembacaan file', async () => {
    admin();
    await changeRequestStatus({
      id: 'request-1',
      expectedStatus: 'pending_review',
      nextStatus: 'approved',
    });
    await saveInvoice({
      amount: '100000',
      number: 'INV/2026/001',
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
  it('membatasi RAB dan file pada riset yang diwakili', async () => {
    admin();
    const profile = getSnapshot().users.find((user) => user.id === 'demo-pengaju');
    if (!profile) throw new Error('Profil tidak tersedia');
    saveUser({ ...profile, researchIds: ['smart'] }, profile.id);
    const allowed = await importRab(rab());
    const other = await importRab({ ...rab(), researchId: 'weather' });
    logoutDemo();
    loginDemo('pengaju@gmail.com', 'pengaju123');
    const current = getSnapshot().users.find((user) => user.id === profile.id);
    if (!current) throw new Error('Profil tidak tersedia');
    expect(scopedRabs(getSnapshot(), current).map((doc) => doc.id)).toEqual([allowed]);
    expect(() => visibleRab(other)).toThrow(/tidak dapat diakses/);
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
      number: 'INV/2026/001',
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
        number: 'INV/2026/001',
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
      number: 'INV/2026/001',
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
        number: 'INV/2026/001',
        invoiceDate: '2026-01-01',
        requestId: 'request-1',
        url: 'https://example.test',
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow(/disetujui/);
    await expect(
      saveInvoice({
        amount: '100000',
        number: 'INV/2026/001',
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
        number: 'INV/2026/001',
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
        number: 'INV/2026/001',
        invoiceDate: '2026-01-01',
        requestId: 'request-1',
        file: file(),
        url: '',
        expectedUpdatedAt: null,
      }),
    ).rejects.toThrow(/akses/);
    await expect(importRab(rab())).rejects.toThrow(/akses/);
  });
  it('versi baru mempertahankan sumber request, alokasi tidak berubah dan Pengaju hanya membaca risetnya', async () => {
    admin();
    const allocation = getSnapshot().research.find((item) => item.id === 'smart')?.allocated;
    const first = await importRab(rab());
    const doc = visibleRab(first);
    const item = doc.items[0];
    if (!item) throw new Error('Barang kosong');
    logoutDemo();
    loginDemo('pengaju@gmail.com', 'pengaju123');
    saveRequest(
      {
        item: item.name,
        researchId: doc.researchId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        requiredDate: requestDateLimits().minimum,
        url: '',
        notes: '',
      },
      undefined,
      { documentId: first, itemId: item.id },
    );
    const request = getSnapshot().requests[0];
    expect(request?.rabDocumentId).toBe(first);
    logoutDemo();
    admin();
    const second = await importRab({ ...rab(), items: [{ ...item, name: 'Versi kedua' }] });
    expect(visibleRab(first).active).toBe(false);
    expect(visibleRab(second).version).toBe(3);
    expect(getSnapshot().research.find((item) => item.id === 'smart')?.allocated).toBe(allocation);
    logoutDemo();
    loginDemo('pengaju@gmail.com', 'pengaju123');
    expect(
      scopedRabs(
        getSnapshot(),
        getSnapshot().users.find((item) => item.id === 'demo-pengaju')!,
      ),
    ).toHaveLength(1);
    expect(visibleRab(first).items[0]?.name).toBe('Sensor');
    expect(getSnapshot().requests[0]?.item).toBe('Sensor');
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
