import { choose } from './helpers';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function chooseAction(page: Page, label: string) {
  const item = label.replace(/^(Edit|Hapus|Batalkan) /, '');
  await page.getByRole('button', { name: `Aksi ${item}`, exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

async function acknowledgeAdminNotice(page: Page) {
  const notice = page.getByRole('dialog', { name: 'Pemberitahuan Request' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Nanti saja', exact: true }).click();
  await expect(notice).toHaveCount(0);
}

async function signIn(page: Page, role: 'admin' | 'pengaju' = 'admin') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
  if (role === 'admin') await acknowledgeAdminNotice(page);
  await expect(page.locator('[data-chart-ready]').first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
}

test('dashboard Admin sesuai ringkasan dan bertahan setelah refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await expect(page.getByRole('article', { name: 'Total Request', exact: true })).toContainText(
    '24',
  );
  await expect(page.getByRole('article', { name: 'Disetujui', exact: true })).toContainText('14');
  await expect(page.getByRole('article', { name: 'Menunggu', exact: true })).toContainText('4');
  await expect(page.getByRole('article', { name: 'Total Nilai', exact: true })).toContainText(
    'Rp 125,4 Jt',
  );
  await expect(page.getByRole('link', { name: 'Manajemen Pengguna' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ekspor Excel' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Pemberitahuan Request' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('dialog', { name: 'Pemberitahuan Request' })).toHaveCount(0);
  const saved = await page.evaluate(() => sessionStorage.getItem('stas-rg-demo-v1'));
  expect(saved).not.toContain('admin123');
  expect(saved).not.toContain('pengaju123');
  expect(errors).toEqual([]);
});

test('pencarian, filter, urutan total, dan keadaan kosong bekerja', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests');
  await page.getByRole('searchbox', { name: 'Cari request' }).fill('Spektrofotometer');
  await expect(
    page.getByRole('cell', { name: 'Spektrofotometer UV-Vis', exact: true }),
  ).toBeVisible();
  await choose(page, page.getByLabel('Filter status'), 'pending_review');
  await expect(page.getByText('Tidak ada request yang sesuai.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ekspor Excel' })).toBeDisabled();
  await page.getByRole('searchbox', { name: 'Cari request' }).fill('');
  await choose(page, page.getByLabel('Filter jenis riset'), 'smart');
  await expect(page.getByRole('cell', { name: 'Oscilloscope Digital', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'pH Meter Digital', exact: true })).toHaveCount(0);
  await choose(page, page.getByLabel('Filter status'), '');
  await choose(page, page.getByLabel('Filter jenis riset'), '');
  await page.getByRole('button', { name: 'Urutkan Total menaik' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('pH Meter Digital');
});

test('halaman detail, navigasi kembali, sidebar dan notifikasi bekerja', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Lihat Oscilloscope Digital', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oscilloscope Digital' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/requests\/request-1/);
  await page.getByRole('link', { name: 'Kembali ke Pembelian Barang', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await page.getByRole('button', { name: 'Ciutkan sidebar' }).click();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Perluas sidebar' }).click();
  await page.getByRole('link', { name: 'Notifikasi, 3 belum dibaca' }).click();
  await expect(page).toHaveURL('/notifications');
  await page.getByRole('button', { name: 'Tandai semua dibaca' }).click();
  await expect(page.getByRole('link', { name: 'Notifikasi, 0 belum dibaca' })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Buka request', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oscilloscope Digital' })).toBeVisible();
});

test('Admin dapat mengedit dan menghapus request dengan konfirmasi', async ({ page }) => {
  await signIn(page);
  await chooseAction(page, 'Edit Oscilloscope Digital');
  await page.getByLabel('Jumlah', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oscilloscope Digital' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByRole('article', { name: 'Total Nilai', exact: true })).toContainText(
    'Rp 137,9 Jt',
  );
  await chooseAction(page, 'Hapus Oscilloscope Digital');
  await page.getByRole('button', { name: 'Kembali', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Oscilloscope Digital', exact: true })).toBeVisible();
  await chooseAction(page, 'Hapus Oscilloscope Digital');
  await page.getByRole('button', { name: 'Hapus Request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Total Request', exact: true })).toContainText(
    '23',
  );
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Pemberitahuan Request' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Oscilloscope Digital', exact: true })).toHaveCount(
    0,
  );
});

test('Pengaju hanya melihat miliknya, membuat request, dan membatalkan yang masih pending', async ({
  page,
}) => {
  await signIn(page, 'pengaju');
  await expect(page.getByRole('link', { name: 'Manajemen Pengguna' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ekspor Excel' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Dr. Muhammad Hasan', exact: true })).toHaveCount(0);
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible();
  await page.goto('/research-types');
  await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible();
  await page.goto('/requests?detail=request-2');
  await expect(
    page.getByRole('heading', { name: 'Request tidak tersedia', level: 1 }),
  ).toBeVisible();
  await page.goto('/requests');
  await page.getByRole('link', { name: 'Buat request' }).click();
  await page.getByLabel('Nama barang', { exact: true }).fill('Sensor Uji');
  await page.getByLabel('Jumlah', { exact: true }).fill('2');
  await page.getByLabel('Harga satuan (Rp)', { exact: true }).fill('150000');
  await expect(page.locator('output')).toContainText('Rp 300.000');
  await page.getByRole('button', { name: 'Ajukan Request' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Sensor Uji', level: 1 })).toBeVisible();
  await page.goto('/requests');
  await page.getByRole('searchbox', { name: 'Cari request' }).fill('Sensor Uji');
  await expect(page.getByRole('cell', { name: 'Sensor Uji', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Sensor Uji', exact: true })).toBeVisible();
  await chooseAction(page, 'Batalkan Sensor Uji');
  await page.getByRole('button', { name: 'Batalkan Request', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Dibatalkan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aksi Sensor Uji', exact: true }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Batalkan Sensor Uji', exact: true }),
  ).toBeDisabled();
});

test('CRUD pengguna dan riset menjaga referensi serta akun utama', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Jenis Riset', exact: true }).click();
  await page.getByRole('link', { name: 'Tambah Jenis Riset', exact: true }).click();
  await page.getByLabel('Nama jenis riset', { exact: true }).fill('Riset Otomasi Uji');
  await page.getByLabel('Alokasi dana (Rp)', { exact: true }).fill('10000000');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/research-types');
  await chooseAction(page, 'Edit Riset Otomasi Uji');
  await page.getByLabel('Alokasi dana (Rp)', { exact: true }).fill('12000000');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await page.getByRole('link', { name: 'Manajemen Pengguna', exact: true }).click();
  await page.getByRole('button', { name: 'Aksi Administrator', exact: true }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Hapus Administrator', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await chooseAction(page, 'Edit Administrator');
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('readonly', '');
  await page.goto('/users');
  await page.getByRole('link', { name: 'Tambah Pengguna', exact: true }).click();
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Pengguna Uji');
  await page.getByLabel('NIP/NIM', { exact: true }).fill('UJI-123');
  await page.getByLabel('Email', { exact: true }).fill('uji@example.test');
  await page.getByLabel('Perwakilan riset', { exact: true }).click();
  await page.getByRole('option', { name: 'Riset Otomasi Uji', exact: true }).click();
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pengguna Uji', level: 1 })).toBeVisible();
  await page.goto('/users');
  await page.getByRole('searchbox', { name: 'Cari pengguna' }).fill('Pengguna Uji');
  await chooseAction(page, 'Edit Pengguna Uji');
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Pengguna Uji Baru');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await page.getByRole('link', { name: 'Jenis Riset', exact: true }).click();
  await chooseAction(page, 'Hapus Riset Otomasi Uji');
  await page.getByRole('button', { name: 'Hapus Jenis Riset', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('perwakilan');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Manajemen Pengguna', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Cari pengguna' }).fill('Pengguna Uji Baru');
  await chooseAction(page, 'Hapus Pengguna Uji Baru');
  await page.getByRole('button', { name: 'Hapus Pengguna', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Pengguna Uji Baru', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Jenis Riset', exact: true }).click();
  await chooseAction(page, 'Hapus Riset Otomasi Uji');
  await page.getByRole('button', { name: 'Hapus Jenis Riset', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Riset Otomasi Uji', exact: true })).toHaveCount(
    0,
  );
});

test('ekspor browser menghasilkan workbook sesuai filter aktif', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests');
  await page.getByRole('searchbox', { name: 'Cari request' }).fill('Oscilloscope');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor Excel', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    const value: unknown = chunk;
    if (!(value instanceof Uint8Array)) throw new Error('Konten ekspor tidak valid');
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(bytes).buffer);
  const sheet = workbook.getWorksheet('Pembelian Barang');
  expect(sheet?.rowCount).toBe(2);
  expect(sheet?.getCell('A2').value).toBe('Oscilloscope Digital');
  expect(sheet?.getCell('F2').value).toBe(12500000);
});

test('pagination, logout, dan pengalihan tamu bekerja', async ({ page }) => {
  for (const path of ['/dashboard', '/requests', '/users', '/research-types']) {
    await page.goto(path);
    await expect(page).toHaveURL('/');
  }
  await signIn(page);
  await page.getByRole('link', { name: 'Pembelian Barang', exact: true }).click();
  await page.getByRole('button', { name: 'Halaman berikutnya' }).click();
  await expect(page.getByText('Halaman 2 dari 5', { exact: true })).toBeVisible();
  await choose(page, page.getByRole('combobox', { name: 'Tampilkan' }), '20');
  await expect(page.getByText('Halaman 1 dari 2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Buka profil Admin', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page.getByLabel('ID / NIM / EMAIL')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/');
});

for (const role of ['admin', 'pengaju'] as const) {
  for (const viewport of [
    { width: 1900, height: 905 },
    { width: 1366, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    test(`dashboard ${role} ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await signIn(page, role);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('[data-chart-ready] svg.recharts-surface').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
      const screenshot = testInfo.outputPath(`${role}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({
        path: screenshot,
        fullPage: viewport.width < 1024,
        animations: 'disabled',
      });
      await testInfo.attach('Dashboard', { path: screenshot, contentType: 'image/png' });
      if (viewport.width < 1024) {
        const menu = page.getByRole('button', { name: 'Buka menu navigasi' });
        await menu.click();
        await expect(page.getByRole('dialog', { name: 'Menu navigasi' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeFocused();
      }
    });
  }
}

test('dashboard dan dialog memenuhi pemeriksaan aksesibilitas desktop dan mobile', async ({
  page,
}) => {
  for (const role of ['admin', 'pengaju'] as const) {
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await page.evaluate(() => sessionStorage.clear());
      await signIn(page, role);
      let result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
      await page.getByRole('link', { name: 'Lihat Oscilloscope Digital', exact: true }).click();
      result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
      await page.getByRole('link', { name: 'Kembali ke Pembelian Barang', exact: true }).click();
      if (width < 1024) {
        await page.getByRole('button', { name: 'Buka menu navigasi' }).click();
        result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(result.violations).toEqual([]);
        await page.keyboard.press('Escape');
      }
    }
  }
});
