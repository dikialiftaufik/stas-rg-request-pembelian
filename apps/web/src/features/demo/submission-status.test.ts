import { describe, expect, it, vi } from 'vitest';
import {
  changeSubmissionStatus,
  deleteRequest,
  getSnapshot,
  loginDemo,
  logoutDemo,
  reloadDemoState,
  saveRequest,
  visibleRequest,
  DEMO_STORAGE_KEY,
} from './store';
import { requestDateLimits, snapshotSchema } from './model';

const change = {
  id: 'request-1',
  expectedStatus: 'not_submitted',
  nextStatus: 'submitted',
} as const;

describe('status pengajuan administratif', () => {
  it('defaults legacy and new requests without changing purchase stages or financial data', () => {
    const data = getSnapshot();
    const legacy = snapshotSchema.parse({
      ...data,
      requests: data.requests.map((row) => ({ ...row, submissionStatus: undefined })),
    });
    expect(legacy.requests.every((row) => row.submissionStatus === 'not_submitted')).toBe(true);
    loginDemo('pengaju@gmail.com', 'pengaju123');
    const id = saveRequest({
      item: 'Barang baru',
      researchId: 'smart',
      unit: 'unit',
      quantity: 1,
      unitPrice: '100',
      requiredDate: requestDateLimits().minimum,
      notes: '',
      url: '',
    });
    expect(visibleRequest(id).submissionStatus).toBe('not_submitted');
    logoutDemo();
    loginDemo('admin@gmail.com', 'admin123');
    const before = visibleRequest(change.id);
    changeSubmissionStatus(change);
    expect(visibleRequest(change.id)).toEqual({
      ...before,
      submissionStatus: 'submitted',
      revision: before.revision + 1,
    });
    reloadDemoState();
    expect(visibleRequest(change.id).submissionStatus).toBe('submitted');
    changeSubmissionStatus({ ...change, expectedStatus: 'submitted', nextStatus: 'not_submitted' });
    expect(visibleRequest(change.id)).toEqual({ ...before, revision: before.revision + 2 });
  });
  it('rejects unauthorized, stale, invalid and deleted requests without mutations', () => {
    const initial = JSON.stringify(getSnapshot());
    expect(() => changeSubmissionStatus(change)).toThrow(/akses/);
    expect(JSON.stringify(getSnapshot())).toBe(initial);
    loginDemo('pengaju@gmail.com', 'pengaju123');
    const own = JSON.stringify(getSnapshot());
    for (const id of ['request-1', 'request-2'])
      expect(() => changeSubmissionStatus({ ...change, id })).toThrow(/akses/);
    expect(JSON.stringify(getSnapshot())).toBe(own);
    logoutDemo();
    loginDemo('admin@gmail.com', 'admin123');
    changeSubmissionStatus(change);
    const after = JSON.stringify(getSnapshot());
    expect(() => changeSubmissionStatus(change)).toThrow(/sudah berubah/);
    expect(() => changeSubmissionStatus({ ...change, nextStatus: 'invalid' as never })).toThrow();
    expect(JSON.stringify(getSnapshot())).toBe(after);
    deleteRequest(change.id);
    const deleted = JSON.stringify(getSnapshot());
    expect(() => changeSubmissionStatus(change)).toThrow(/tidak ditemukan/);
    expect(JSON.stringify(getSnapshot())).toBe(deleted);
  });
  it('preserves both memory and saved data when storage fails', () => {
    loginDemo('admin@gmail.com', 'admin123');
    const before = JSON.stringify(getSnapshot());
    const stored = sessionStorage.getItem(DEMO_STORAGE_KEY);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota');
    });
    expect(() => changeSubmissionStatus(change)).toThrow(/gagal disimpan/);
    spy.mockRestore();
    expect(JSON.stringify(getSnapshot())).toBe(before);
    expect(sessionStorage.getItem(DEMO_STORAGE_KEY)).toBe(stored);
  });
});
