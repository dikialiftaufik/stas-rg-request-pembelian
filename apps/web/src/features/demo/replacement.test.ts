import { describe, expect, it, vi } from 'vitest';
import {
  loginDemo,
  logoutDemo,
  getSnapshot,
  visibleRequest,
  proposeReplacement,
  respondReplacement,
  changeRequestStatus,
  saveRequest,
  saveResearch,
  reloadDemoState,
  deleteRequest,
} from './store';
const offer = {
  url: 'https://example.test/alternatif',
  unitPrice: '5000000',
  reason: 'Penjual memberikan penawaran baru.',
};
const admin = () => loginDemo('admin@gmail.com', 'admin123');
const owner = () => {
  logoutDemo();
  loginDemo('pengaju@gmail.com', 'pengaju123');
};
function propose(id = 'request-11') {
  admin();
  const row = visibleRequest(id);
  proposeReplacement(id, row.revision, offer);
  return visibleRequest(id);
}
describe('replacement proposals', () => {
  it('pauses approved purchases, applies owner acceptance and preserves RAB and invoice metadata', async () => {
    admin();
    const before = visibleRequest('request-3');
    // Use a request owned by the login account at an approved stage.
    const row = visibleRequest('request-19');
    proposeReplacement(row.id, row.revision, offer);
    await expect(
      changeRequestStatus({ id: row.id, expectedStatus: 'approved', nextStatus: 'ordered' }),
    ).rejects.toThrow(/dijeda/);
    expect(() => saveRequest({ ...row, url: offer.url }, row.id)).toThrow(/Tuntaskan/);
    owner();
    const current = visibleRequest(row.id);
    const proposal = current.replacements.at(-1)!;
    respondReplacement(row.id, current.revision, proposal.id, 'accepted');
    const accepted = visibleRequest(row.id);
    expect(accepted).toMatchObject({
      url: offer.url,
      unitPrice: offer.unitPrice,
      status: row.status,
      invoice: row.invoice,
      rabDocumentId: row.rabDocumentId,
      revision: row.revision + 2,
    });
    reloadDemoState();
    expect(visibleRequest(row.id).replacements.at(-1)?.status).toBe('accepted');
    admin();
    await changeRequestStatus({ id: row.id, expectedStatus: 'approved', nextStatus: 'ordered' });
    expect(visibleRequest(before.id)).toEqual(before);
  });
  it('supports ordered proposals, rejection with reason and a second alternative', () => {
    const row = propose('request-12');
    owner();
    const p = row.replacements.at(-1)!;
    expect(() => respondReplacement(row.id, row.revision, p.id, 'rejected')).toThrow(/alasan/);
    respondReplacement(row.id, row.revision, p.id, 'rejected', 'Cari penjual dengan garansi.');
    admin();
    const rejected = visibleRequest(row.id);
    expect(rejected.url).toBe(p.previousUrl);
    proposeReplacement(row.id, rejected.revision, {
      ...offer,
      url: 'https://example.test/garansi',
    });
    expect(visibleRequest(row.id).replacements).toHaveLength(2);
  });
  it('rejects unauthorized, stale, duplicate, unchanged, invalid and late-stage operations', () => {
    owner();
    expect(() => proposeReplacement('request-19', 0, offer)).toThrow(/akses/);
    admin();
    const row = visibleRequest('request-19');
    expect(() =>
      proposeReplacement(row.id, row.revision, { ...offer, url: 'javascript:alert(1)' }),
    ).toThrow();
    expect(() =>
      proposeReplacement(row.id, row.revision, {
        ...offer,
        url: row.url,
        unitPrice: row.unitPrice,
      }),
    ).toThrow();
    proposeReplacement(row.id, row.revision, offer);
    const pending = visibleRequest(row.id);
    expect(() => proposeReplacement(row.id, pending.revision, offer)).toThrow(/Tunggu/);
    expect(() =>
      respondReplacement(row.id, pending.revision, pending.replacements[0]!.id, 'accepted'),
    ).toThrow(/pemilik/);
    owner();
    expect(() =>
      respondReplacement(row.id, row.revision, pending.replacements[0]!.id, 'accepted'),
    ).toThrow(/berubah/);
    admin();
    expect(() => proposeReplacement('request-11', 0, offer)).toThrow(/sebelum pengiriman/);
    deleteRequest(row.id);
    expect(() => proposeReplacement(row.id, pending.revision, offer)).toThrow(/tidak ditemukan/);
  });
  it('keeps data and notifications unchanged on quota failure and budget rejection', () => {
    admin();
    const row = visibleRequest('request-19');
    const initial = JSON.stringify(getSnapshot());
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota');
    });
    expect(() => proposeReplacement(row.id, row.revision, offer)).toThrow(/gagal disimpan/);
    spy.mockRestore();
    expect(JSON.stringify(getSnapshot())).toBe(initial);
    proposeReplacement(row.id, row.revision, { ...offer, unitPrice: '99999999999' });
    owner();
    const pending = visibleRequest(row.id);
    const before = JSON.stringify(getSnapshot());
    expect(() =>
      respondReplacement(row.id, pending.revision, pending.replacements[0]!.id, 'accepted'),
    ).toThrow(/Alokasi/);
    expect(JSON.stringify(getSnapshot())).toBe(before);
    admin();
    const research = getSnapshot().research.find((r) => r.id === row.researchId)!;
    saveResearch({ ...research, allocated: '999999999999' }, research.id);
    owner();
    respondReplacement(row.id, pending.revision, pending.replacements[0]!.id, 'accepted');
    expect(visibleRequest(row.id).unitPrice).toBe('99999999999');
  });
});
