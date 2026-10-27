import { describe, expect, it } from 'vitest';
import { createSeed } from '../demo/seed';
import type { DemoSnapshot } from '../demo/model';
import { adminRequestNotices } from './admin-request-notices';

function account(data: DemoSnapshot, id = 'demo-admin') {
  const user = data.users.find((item) => item.id === id);
  if (!user) throw new Error('Akun tidak ditemukan');
  return user;
}

describe('pemberitahuan request Admin', () => {
  it('mengambil seluruh request yang relevan tanpa mengubah dataset', () => {
    const data = createSeed();
    const before = JSON.stringify(data);
    expect(adminRequestNotices(data, account(data)).map((item) => item.id)).toEqual([
      'request-1',
      'request-5',
      'request-6',
      'request-7',
    ]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('tidak memberikan hard popup untuk Pengaju', () => {
    const data = createSeed();
    expect(adminRequestNotices(data, account(data, 'demo-pengaju'))).toEqual([]);
  });
  it('tetap mengingatkan persetujuan yang belum selesai meskipun notifikasi telah dibaca', () => {
    const data = createSeed();
    data.notifications = data.notifications.map((item) => ({ ...item, read: true }));
    expect(adminRequestNotices(data, account(data))).toHaveLength(4);
  });
  it('mengabaikan request terhapus, status yang sudah diproses, dan notifikasi duplikat', () => {
    const data = createSeed();
    data.requests = data.requests.map((item) =>
      item.id === 'request-1'
        ? { ...item, deleted: true }
        : item.id === 'request-5'
          ? { ...item, status: 'cancelled' }
          : item,
    );
    const notice = data.notifications.find((item) => item.requestId === 'request-6');
    if (!notice) throw new Error('Notifikasi tidak tersedia');
    data.notifications.unshift({ ...notice, id: 'duplicate', createdAt: '2026-10-26T08:00:00Z' });
    expect(adminRequestNotices(data, account(data)).map((item) => item.id)).toEqual([
      'request-6',
      'request-7',
    ]);
  });
  it('menggunakan request pending ketika belum ada notifikasi', () => {
    const data = createSeed();
    data.notifications = [];
    expect(adminRequestNotices(data, account(data))).toHaveLength(4);
  });
  it('menghasilkan keadaan kosong jika tidak ada persetujuan yang tertunda', () => {
    const data = createSeed();
    data.requests = data.requests.map((item) => ({ ...item, status: 'approved' }));
    expect(adminRequestNotices(data, account(data))).toEqual([]);
  });
});
