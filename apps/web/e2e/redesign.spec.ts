import { choose } from './helpers';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function signIn(page: Page, role: 'admin' | 'pengaju' = 'admin') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
  if (role === 'admin') await page.getByRole('button', { name: 'Nanti saja' }).click();
  await expect(page.locator('[data-chart-ready]').first()).toBeVisible();
}

test('Admin memproses semua tahapan, toast, riwayat dan notifikasi tersimpan', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests?detail=request-1');
  const detail = page.getByRole('main');
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stas-rg-demo-v1');
    if (!raw) throw new Error('Missing snapshot');
    const snapshot = JSON.parse(raw) as { requests: { id: string; invoice: unknown }[] };
    const request = snapshot.requests.find((item) => item.id === 'request-1');
    if (request)
      request.invoice = {
        amount: '12500000',
        invoiceDate: '2026-01-01',
        file: null,
        url: 'https://example.test/invoice',
        updatedAt: new Date().toISOString(),
        updatedBy: 'demo-admin',
      };
    sessionStorage.setItem('stas-rg-demo-v1', JSON.stringify(snapshot));
  });
  await page.reload();
  for (const status of ['approved', 'ordered', 'in_transit', 'delivered', 'completed']) {
    await detail.getByRole('link', { name: 'Ubah status', exact: true }).click();
    await choose(page, page.getByLabel('Status berikutnya'), status);
    await page.getByLabel('Catatan perubahan (opsional)').fill('Tahap diverifikasi Admin.');
    await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
    await expect(
      page.getByText('Status Oscilloscope Digital berhasil diperbarui.', { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByLabel('Status berikutnya')).toHaveCount(0);
  }
  await expect(detail.getByRole('link', { name: 'Ubah status', exact: true })).toHaveCount(0);
  await expect(
    detail.locator('details').filter({ hasText: 'Riwayat perubahan' }).locator('li'),
  ).toHaveCount(5);
  await page.reload();
  await expect(
    detail.locator('details').filter({ hasText: 'Riwayat perubahan' }).locator('li'),
  ).toHaveCount(5);
  await expect(detail.locator('[data-status="completed"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await signIn(page, 'pengaju');
  await page.getByRole('link', { name: 'Notifikasi, 7 belum dibaca' }).click();
  await expect(page.getByRole('main')).toContainText('Oscilloscope Digital: Selesai.');
  await page.keyboard.press('Escape');
  await page.goto('/requests?detail=request-1');
  await expect(detail.getByRole('link', { name: 'Ubah status', exact: true })).toHaveCount(0);
});

test('penolakan memerlukan alasan, kegagalan tidak menghasilkan toast berhasil', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/requests?status=pending_review');
  await page.getByRole('button', { name: 'Aksi Oscilloscope Digital', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Ubah status', exact: true }).click();
  await choose(page, page.getByLabel('Status berikutnya'), 'rejected');
  await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
  await expect(page.getByLabel('Alasan penolakan')).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('Jelaskan alasan');
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
  await page.getByLabel('Alasan penolakan').fill('Kebutuhan perlu diperjelas.');
  await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
  await expect(page.getByRole('main')).toContainText('Kebutuhan perlu diperjelas.');
  await page.goto('/requests?status=pending_review');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.goto('/dashboard');
  await expect(page.getByRole('article', { name: 'Menunggu', exact: true })).toContainText('3');
});

test('validasi alokasi menjaga status dan riwayat saat persetujuan gagal', async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stas-rg-demo-v1');
    if (!raw) throw new Error('Snapshot tidak tersedia');
    const data = JSON.parse(raw) as { research: { id: string; allocated: string }[] };
    const research = data.research.find((item) => item.id === 'smart');
    if (research) research.allocated = '9000000';
    sessionStorage.setItem('stas-rg-demo-v1', JSON.stringify(data));
  });
  await page.goto('/requests?detail=request-1');
  await page.getByRole('link', { name: 'Ubah status', exact: true }).click();
  await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
  await expect(page.getByRole('alert')).toContainText('Alokasi dana riset tidak mencukupi');
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
  await page.goto('/requests/request-1');
  await expect(
    page.locator('details').filter({ hasText: 'Riwayat perubahan' }).locator('li'),
  ).toHaveCount(0);
});

test('seluruh header tabel mengurutkan, memperbarui URL dan mereset halaman', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests?page=3');
  for (const name of ['Barang', 'Jumlah', 'Total', 'Status', 'Diajukan', 'Invoice']) {
    await page.getByRole('button', { name: `Urutkan ${name} menaik`, exact: true }).click();
    await expect(page.locator('th[aria-sort="ascending"]')).toHaveCount(1);
    await expect(page).not.toHaveURL(/page=3/);
    await page.getByRole('button', { name: `Urutkan ${name} menurun`, exact: true }).click();
    await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);
  }
  for (const name of ['Pengaju', 'Riset']) {
    for (const direction of ['A–Z', 'Z–A']) {
      await page.getByRole('button', { name: 'Urutkan pengaju atau riset' }).click();
      await page.getByRole('menuitem', { name: `${name} ${direction}`, exact: true }).click();
      await expect(
        page.locator(`th[aria-sort="${direction === 'A–Z' ? 'ascending' : 'descending'}"]`),
      ).toHaveCount(1);
    }
  }
  await page.goto('/requests?sort=asc');
  await expect(page.locator('tbody tr').first()).toContainText('pH Meter Digital');
  await page.reload();
  await expect(page.locator('th[aria-sort="ascending"]')).toContainText('Total');
  await page.goto('/users');
  for (const name of [
    'Nama lengkap',
    'NIP/NIM',
    'Email',
    'Peran',
    'Perwakilan riset',
    'Tanggal dibuat',
  ]) {
    const descending = page.getByRole('button', { name: `Urutkan ${name} menurun`, exact: true });
    if (await descending.count()) await descending.click();
    await page.getByRole('button', { name: `Urutkan ${name} menaik`, exact: true }).click();
    await expect(page.locator('th[aria-sort="ascending"]')).toHaveCount(1);
    await page.getByRole('button', { name: `Urutkan ${name} menurun`, exact: true }).click();
    await expect(page.locator('th[aria-sort="descending"]')).toHaveCount(1);
  }
});

test('menu aksi mendukung keyboard, pengembalian fokus dan klik luar', async ({ page }) => {
  await signIn(page);
  await page.goto('/users');
  const trigger = page.getByRole('button', { name: 'Aksi Ir. Citra Dewi', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Edit Ir. Citra Dewi' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Hapus Ir. Citra Dewi' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Edit Ir. Citra Dewi' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitem', { name: 'Edit Ir. Citra Dewi' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(260, 90);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('link', { name: 'Lihat semua perwakilan riset Ir. Citra Dewi' }).click();
  await expect(page.getByRole('main').locator('ul li')).toHaveCount(6);
  await page.keyboard.press('Escape');
  const logout = page.getByRole('button', { name: 'Keluar', exact: true });
  await logout.hover();
  await expect(logout).toHaveCSS('color', 'rgb(180, 35, 24)');
});

test('ekspor seluruh hasil lintas pagination mengikuti filter dan urutan aktif', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Ekspor Excel' })).toHaveCount(0);
  await page.goto('/requests?status=approved&sortBy=item&sortDir=asc');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor Excel' }).click();
  const download = await downloadEvent;
  const chunks: Uint8Array[] = [];
  for await (const chunk of await download.createReadStream()) {
    const value: unknown = chunk;
    if (value instanceof Uint8Array) chunks.push(value);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(Buffer.concat(chunks)).buffer);
  const sheet = workbook.getWorksheet('Pembelian Barang');
  expect(sheet?.rowCount).toBe(19);
  const names: string[] = [];
  sheet?.eachRow((row, index) => {
    if (index > 1) names.push(row.getCell(1).text);
  });
  expect(names).toEqual(
    names.toSorted(new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' }).compare),
  );
  await expect(page.getByText('Daftar request berhasil diekspor.', { exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`halaman operasional dan form responsif ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    for (const path of ['/requests', '/users', '/research-types']) {
      await page.goto(path);
      await page.getByRole('heading', { level: 1 }).waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
      const screenshot = testInfo.outputPath(`${path.slice(1)}-${viewport.width}.png`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(path, { path: screenshot, contentType: 'image/png' });
    }
    await page.goto('/requests?detail=request-1');
    await page.getByRole('link', { name: 'Ubah status', exact: true }).click();
    await choose(page, page.getByLabel('Status berikutnya'), 'rejected');
    await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}

test('pembesaran teks 200 persen menjaga halaman dan dialog dapat digunakan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('link', { name: 'Lihat Oscilloscope Digital', exact: true }).click();
  const content = page.getByRole('main');
  expect(await content.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Oscilloscope Digital' })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke Pembelian Barang', exact: true }).click();
});
