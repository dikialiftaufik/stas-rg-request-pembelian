import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import {
  requestDateLimits,
  requestTotal,
  moneySchema,
  requestInputSchema,
  researchInputSchema,
} from './model';
import {
  cancelRequest,
  currentUser,
  dashboardSummary,
  deleteRequest,
  deleteResearch,
  deleteUser,
  DEMO_STORAGE_KEY,
  getSnapshot,
  loginDemo,
  logoutDemo,
  markNotificationsRead,
  reloadDemoState,
  saveRequest,
  saveResearch,
  saveUser,
  scopedRequests,
  visibleRequest,
} from './store';
import type { RequestInput } from './model';

function admin() {
  expect(loginDemo('admin@gmail.com', 'admin123')).toBe(true);
}
function pengaju() {
  expect(loginDemo('pengaju@gmail.com', 'pengaju123')).toBe(true);
}
function requestInput(): RequestInput {
  return {
    item: 'Barang pengujian',
    researchId: 'smart',
    quantity: 3,
    unitPrice: '0.10',
    requiredDate: requestDateLimits().minimum,
    url: 'https://example.test/item',
    notes: '',
  };
}

describe('sesi demo', () => {
  it.each([
    ['admin@gmail.com', 'pengaju123'],
    ['pengaju@gmail.com', 'admin123'],
    ['other@gmail.com', 'admin123'],
    ['admin@gmail.com', 'admin123 '],
    ['admin@gmail.com', 'ADMIN123'],
  ])('menolak pasangan yang salah: %s / %s', (email, password) => {
    expect(loginDemo(email, password)).toBe(false);
    expect(currentUser()).toBeNull();
  });
  it('menormalisasi email, mempertahankan sesi saat refresh, dan tidak menyimpan password', () => {
    expect(loginDemo(' ADMIN@GMAIL.COM ', 'admin123')).toBe(true);
    reloadDemoState();
    expect(currentUser()?.role).toBe('admin');
    const saved = sessionStorage.getItem(DEMO_STORAGE_KEY) ?? '';
    expect(saved).not.toContain('admin123');
    expect(saved).not.toContain('pengaju123');
    expect(saved).not.toContain('password');
    logoutDemo();
    reloadDemoState();
    expect(currentUser()).toBeNull();
  });
  it.each(['{invalid', '{"version":999}', JSON.stringify({ ...createSeed(), users: [] })])(
    'memulihkan snapshot rusak',
    (saved) => {
      sessionStorage.setItem(DEMO_STORAGE_KEY, saved);
      reloadDemoState();
      expect(getSnapshot().requests).toHaveLength(24);
      expect(currentUser()).toBeNull();
    },
  );
  it('logout mempertahankan perubahan data saat beralih akun dalam tab yang sama', () => {
    admin();
    saveResearch({ name: 'Riset Baru', description: '', allocated: '1000000' });
    logoutDemo();
    pengaju();
    reloadDemoState();
    expect(getSnapshot().research.some((item) => item.name === 'Riset Baru')).toBe(true);
  });
});

describe('cakupan peran dan request', () => {
  it.each(['', 'abc', '1.234', '-1', '1.2.3'])(
    'memvalidasi nominal tidak valid tanpa membuat form crash: %s',
    (value) => {
      expect(moneySchema.safeParse(value).success).toBe(false);
      expect(requestInputSchema.safeParse({ ...requestInput(), unitPrice: value }).success).toBe(
        false,
      );
      expect(
        researchInputSchema.safeParse({ name: 'Uji', description: '', allocated: value }).success,
      ).toBe(false);
    },
  );
  it('menghitung ringkasan Admin dari 24 request dan nominal yang konsisten', () => {
    admin();
    const user = currentUser();
    if (!user) throw new Error('Akun tidak tersedia');
    const summary = dashboardSummary(getSnapshot(), user);
    expect([summary.total, summary.approved, summary.pending]).toEqual([24, 18, 4]);
    expect(summary.value.toString()).toBe('125400000');
  });
  it('membatasi pembacaan Pengaju dan menolak akses detail pengguna lain', () => {
    pengaju();
    const user = currentUser();
    if (!user) throw new Error('Akun tidak tersedia');
    const rows = scopedRequests(getSnapshot(), user);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(24);
    expect(rows.every((item) => item.ownerId === user.id)).toBe(true);
    expect(() => visibleRequest('request-2')).toThrow(/tidak dapat diakses/);
  });
  it('menolak mutasi Admin dari sesi Pengaju', () => {
    pengaju();
    expect(() => deleteRequest('request-1')).toThrow(/akses/);
    expect(() => saveRequest(requestInput(), 'request-1')).toThrow(/akses/);
    expect(() => saveResearch({ name: 'Terlarang', allocated: '1000', description: '' })).toThrow(
      /akses/,
    );
    expect(() => deleteResearch('smart')).toThrow(/akses/);
    expect(() => deleteUser('hasan')).toThrow(/akses/);
  });
  it('membuat request dengan pemilik sesi, kalkulasi desimal tepat, dan notifikasi Admin', () => {
    pengaju();
    saveRequest(requestInput());
    const created = getSnapshot().requests.find((item) => item.item === 'Barang pengujian');
    expect(created?.ownerId).toBe('demo-pengaju');
    expect(created?.status).toBe('pending_review');
    if (!created) throw new Error('Request tidak tersedia');
    expect(requestTotal(created).toString()).toBe('0.3');
    expect(getSnapshot().notifications[0]?.recipientId).toBe('demo-admin');
    expect(() => saveRequest({ ...requestInput(), quantity: 0 })).toThrow();
    expect(() => saveRequest({ ...requestInput(), url: 'javascript:alert(1)' })).toThrow();
  });
  it('hanya mengizinkan pembatalan request pending milik sendiri', () => {
    pengaju();
    expect(() => cancelRequest('request-2')).toThrow();
    expect(() => cancelRequest('request-13')).toThrow();
    cancelRequest('request-1');
    expect(visibleRequest('request-1').status).toBe('cancelled');
    expect(() => cancelRequest('request-1')).toThrow();
  });
  it('memperbarui ringkasan saat request diedit dan dihapus', () => {
    admin();
    const original = visibleRequest('request-1');
    saveRequest({ ...original, quantity: 2 }, original.id);
    const user = currentUser();
    if (!user) throw new Error('Akun tidak tersedia');
    expect(dashboardSummary(getSnapshot(), user).value.toString()).toBe('137900000');
    deleteRequest(original.id);
    expect(dashboardSummary(getSnapshot(), user).total).toBe(23);
    expect(dashboardSummary(getSnapshot(), user).value.toString()).toBe('112900000');
    expect(() => visibleRequest(original.id)).toThrow();
    expect(getSnapshot().requests.find((item) => item.id === original.id)?.deleted).toBe(true);
  });
  it('menolak pemakaian dana melebihi alokasi dan perubahan tidak diterapkan sebagian', () => {
    admin();
    const request = visibleRequest('request-3');
    expect(() => saveRequest({ ...request, unitPrice: '9999999999' }, request.id)).toThrow(
      /alokasi/,
    );
    expect(visibleRequest(request.id).unitPrice).toBe(request.unitPrice);
    expect(() =>
      saveResearch({ name: 'Smart Mannequin', description: '', allocated: '1' }, 'smart'),
    ).toThrow(/digunakan/);
  });
  it('menghitung H-3 dengan akhir pekan dan tanggal WIB', () => {
    expect(requestDateLimits(new Date('2026-10-23T03:00:00Z')).minimum).toBe('2026-10-28');
    expect(requestDateLimits(new Date('2026-10-25T18:00:00Z')).minimum).toBe('2026-10-29');
    pengaju();
    expect(() => saveRequest({ ...requestInput(), requiredDate: '2020-01-01' })).toThrow(/H-3/);
  });
});

describe('pengguna, riset, dan notifikasi', () => {
  it('melindungi akun utama dan entitas yang masih dirujuk', () => {
    admin();
    expect(() => deleteUser('demo-admin')).toThrow(/utama/);
    expect(() => deleteUser('demo-pengaju')).toThrow(/utama/);
    expect(() => deleteUser('hasan')).toThrow(/dirujuk/);
    expect(() => deleteResearch('smart')).toThrow(/dirujuk/);
    const user = currentUser();
    if (!user) throw new Error('Akun tidak tersedia');
    expect(() => saveUser({ ...user, email: 'other@gmail.com' }, user.id)).toThrow(
      /tidak dapat diubah/,
    );
  });
  it('mendukung CRUD riset dan pengguna tambahan tanpa menambah akun login', () => {
    admin();
    saveResearch({ name: 'Riset Uji', description: 'Contoh', allocated: '100000' });
    const research = getSnapshot().research.find((item) => item.name === 'Riset Uji');
    if (!research) throw new Error('Riset tidak tersedia');
    saveResearch({ ...research, allocated: '200000' }, research.id);
    saveUser({
      name: 'Pengguna Uji',
      email: 'uji@example.test',
      identifier: 'UJI-001',
      role: 'pengaju',
      researchIds: [research.id],
    });
    const user = getSnapshot().users.find((item) => item.email === 'uji@example.test');
    if (!user) throw new Error('Pengguna tidak tersedia');
    saveUser({ ...user, name: 'Nama Diperbarui' }, user.id);
    expect(() => saveUser({ ...user })).toThrow(/sudah digunakan/);
    expect(() => deleteResearch(research.id)).toThrow(/ditugaskan/);
    expect(loginDemo('uji@example.test', 'pengaju123')).toBe(false);
    deleteUser(user.id);
    deleteResearch(research.id);
    expect(getSnapshot().research.some((item) => item.id === research.id)).toBe(false);
  });
  it('menandai hanya notifikasi pengguna aktif dan mempertahankan status saat refresh', () => {
    pengaju();
    markNotificationsRead(['notice-1']);
    expect(getSnapshot().notifications.find((item) => item.id === 'notice-1')?.read).toBe(false);
    markNotificationsRead();
    reloadDemoState();
    expect(
      getSnapshot()
        .notifications.filter((item) => item.recipientId === 'demo-pengaju')
        .every((item) => item.read),
    ).toBe(true);
    expect(
      getSnapshot()
        .notifications.filter((item) => item.recipientId === 'demo-admin')
        .some((item) => !item.read),
    ).toBe(true);
  });
});
