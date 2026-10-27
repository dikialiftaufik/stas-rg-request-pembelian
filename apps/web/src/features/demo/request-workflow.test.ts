import { describe, expect, it } from 'vitest';
import {
  changeRequestStatus,
  getSnapshot,
  loginDemo,
  visibleRequest,
  saveResearch,
  reloadDemoState,
} from './store';
import { allowedNextStatuses } from './request-workflow';
import { researchUsed } from './model';

const admin = () => loginDemo('admin@gmail.com', 'admin123');
describe('alur status pembelian', () => {
  it('mencatat seluruh tahapan, pelaku, waktu dan notifikasi secara persisten', async () => {
    admin();
    for (const nextStatus of [
      'approved',
      'ordered',
      'in_transit',
      'delivered',
      'completed',
    ] as const) {
      const before = visibleRequest('request-1');
      await changeRequestStatus({
        id: before.id,
        expectedStatus: before.status,
        nextStatus,
        reason: 'Tahapan diverifikasi.',
      });
      const current = visibleRequest(before.id);
      expect(current.status).toBe(nextStatus);
      expect(current.statusHistory.at(-1)).toMatchObject({
        from: before.status,
        to: nextStatus,
        actorId: 'demo-admin',
        reason: 'Tahapan diverifikasi.',
      });
      expect(Number.isNaN(Date.parse(current.statusHistory.at(-1)?.at ?? ''))).toBe(false);
      expect(getSnapshot().notifications[0]).toMatchObject({
        recipientId: before.ownerId,
        requestId: before.id,
        read: false,
      });
    }
    reloadDemoState();
    expect(visibleRequest('request-1').statusHistory).toHaveLength(5);
    expect(allowedNextStatuses('completed')).toEqual([]);
  });
  it('menolak loncatan, perubahan stale, dan perubahan request terhapus tanpa menulis data', async () => {
    admin();
    const before = JSON.stringify(getSnapshot());
    await expect(
      changeRequestStatus({
        id: 'request-1',
        expectedStatus: 'pending_review',
        nextStatus: 'delivered',
      }),
    ).rejects.toThrow(/tidak diizinkan/);
    await expect(
      changeRequestStatus({ id: 'request-1', expectedStatus: 'approved', nextStatus: 'ordered' }),
    ).rejects.toThrow(/sudah berubah/);
    expect(JSON.stringify(getSnapshot())).toBe(before);
  });
  it('penolakan wajib memiliki alasan dan menjadi status akhir', async () => {
    admin();
    const before = JSON.stringify(getSnapshot());
    await expect(
      changeRequestStatus({
        id: 'request-1',
        expectedStatus: 'pending_review',
        nextStatus: 'rejected',
        reason: '   ',
      }),
    ).rejects.toThrow(/alasan/);
    expect(JSON.stringify(getSnapshot())).toBe(before);
    await changeRequestStatus({
      id: 'request-1',
      expectedStatus: 'pending_review',
      nextStatus: 'rejected',
      reason: 'Anggaran diprioritaskan untuk kebutuhan lain.',
    });
    expect(visibleRequest('request-1').statusHistory[0]?.reason).toContain('Anggaran');
    expect(allowedNextStatuses('rejected')).toEqual([]);
    expect(allowedNextStatuses('cancelled')).toEqual([]);
  });
  it('Pengaju dan tamu tidak dapat mengubah status walau memanggil mutasi langsung', async () => {
    for (const loggedIn of [false, true]) {
      if (loggedIn) loginDemo('pengaju@gmail.com', 'pengaju123');
      const before = JSON.stringify(getSnapshot());
      await expect(
        changeRequestStatus({
          id: 'request-1',
          expectedStatus: 'pending_review',
          nextStatus: 'approved',
        }),
      ).rejects.toThrow(/akses/);
      expect(JSON.stringify(getSnapshot())).toBe(before);
    }
  });
  it('memblokir persetujuan yang melebihi alokasi tanpa riwayat atau notifikasi baru', async () => {
    admin();
    const research = getSnapshot().research.find((item) => item.id === 'smart');
    if (!research) throw new Error('Riset tidak tersedia');
    saveResearch(
      { ...research, allocated: researchUsed(getSnapshot(), research.id).toString() },
      research.id,
    );
    const before = JSON.stringify(getSnapshot());
    await expect(
      changeRequestStatus({
        id: 'request-1',
        expectedStatus: 'pending_review',
        nextStatus: 'approved',
      }),
    ).rejects.toThrow(/Alokasi/);
    expect(JSON.stringify(getSnapshot())).toBe(before);
  });
});
