import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import AxeBuilder from '@axe-core/playwright';
import { choose } from './helpers';
async function login(page: Page, role: 'admin' | 'pengaju' = 'admin') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  if (role === 'admin') await page.getByRole('button', { name: 'Nanti saja' }).click();
  await expect(page.locator('[data-chart-ready] svg.recharts-surface').first()).toBeVisible();
}
test('periode tren, nama bulan dan peta urgensi memakai data serta URL independen', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await expect(
    page.getByRole('heading', { name: 'Peta urgensi request', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Alokasi dan komitmen per riset', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Periode tren:/ }).click();
  await page.getByLabel('Dari tanggal', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Sampai tanggal', { exact: true }).fill('2026-10-26');
  await page.getByRole('button', { name: 'Terapkan', exact: true }).click();
  await expect(page).toHaveURL(/trendFrom=2026-10-20/);
  await expect(page).not.toHaveURL(/[?&]from=/);
  await page.getByText('Lihat data tren', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Nilai pengajuan per periode' }).locator('tbody tr'),
  ).toHaveCount(7);
  await expect(page.getByRole('table', { name: 'Nilai pengajuan per periode' })).toContainText(
    '20 Okt 2026',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: /^Periode tren: 20 Okt/ })).toBeVisible();
  await choose(page, page.getByLabel('Riset peta urgensi'), 'smart');
  await page.getByText(/^Lihat daftar prioritas/).click();
  const priority = page.getByRole('table', { name: /Urutan tanggal terdekat/ });
  await expect(priority.locator('tbody tr')).toHaveCount(6);
  await priority.getByRole('link', { name: 'Oscilloscope Digital', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oscilloscope Digital' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('grafik Pengaju menyaring data pribadi dan mempertahankan pilihan periode', async ({
  page,
}) => {
  await login(page, 'pengaju');
  const section = page.getByRole('region', { name: 'Analitik pengajuan pribadi' });
  await expect(
    section.getByRole('heading', { name: 'Request yang perlu ditindaklanjuti' }),
  ).toBeVisible();
  await expect(
    section.getByRole('heading', { name: 'Tren pengajuan dan penerimaan' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kebutuhan barang saya' })).toHaveCount(0);
  await choose(page, section.getByLabel('Status tindak lanjut'), 'pending_review');
  await section.getByText('Lihat daftar tindak lanjut', { exact: true }).click();
  const table = section.getByRole('table', {
    name: 'Request aktif milik Anda berdasarkan usia pengajuan',
  });
  await expect(table.getByRole('link', { name: 'Oscilloscope Digital' })).toBeVisible();
  await expect(table.getByRole('link', { name: 'Spektrofotometer UV-Vis' })).toHaveCount(0);
  await section.getByLabel('Periode tren pribadi').click();
  await page.getByRole('option', { name: '4 minggu terakhir', exact: true }).click();
  await expect(page).toHaveURL(/personalWeeks=4/);
  await page.reload();
  await expect(page.getByLabel('Status tindak lanjut')).toContainText('Menunggu Persetujuan');
  await expect(page.getByLabel('Periode tren pribadi')).toContainText('4 minggu terakhir');
  const trend = page.getByRole('group', {
    name: 'Grafik tren pengajuan dan penerimaan',
    exact: true,
  });
  await expect(trend.locator('svg.recharts-surface')).toBeVisible();
  await page.screenshot({ path: '.turbo/purchase-finish/pengaju-charts.png', fullPage: true });
  await trend
    .getByRole('button', { name: /^Lihat pengajuan minggu/ })
    .first()
    .click();
  await expect(page).toHaveURL(/personalWeek=/);
  await expect(page.getByRole('region', { name: 'Barang pada minggu terpilih' })).toBeVisible();
  const firstWeek = page.url();
  await trend
    .getByRole('button', { name: /^Lihat pengajuan minggu/ })
    .last()
    .focus();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(firstWeek);
  await page.goto('/requests/request-2/invoice');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Request tidak tersedia' }),
  ).toBeVisible();
  await page.goto('/requests/request-1/replacement');
  await expect(page.getByRole('heading', { level: 1, name: 'Penawaran pengganti' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirim untuk ditinjau Pengaju' })).toHaveCount(0);
});

test('halaman form menjaga perubahan dan mengembalikan konteks daftar', async ({ page }) => {
  await login(page);
  await page.goto('/requests?status=approved&page=2&sortBy=item&sortDir=asc');
  const first = page.locator('tbody tr').first();
  const item = await first.locator('td').first().innerText();
  await first.getByRole('button', { name: `Aksi ${item}`, exact: true }).click();
  await page.getByRole('menuitem', { name: `Edit ${item}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Catatan (opsional)', { exact: true }).fill('Koreksi catatan barang.');
  await page.getByRole('link', { name: 'Jenis Riset', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Tinggalkan perubahan?' })).toBeVisible();
  await page.getByRole('button', { name: 'Tetap di halaman', exact: true }).click();
  await expect(page.getByLabel('Catatan (opsional)', { exact: true })).toHaveValue(
    'Koreksi catatan barang.',
  );
  await page.getByRole('button', { name: 'Simpan Perubahan', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: item })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke Pembelian Barang', exact: true }).click();
  await expect(page).toHaveURL('/requests?status=approved&page=2&sortBy=item&sortDir=asc');
  await expect(page.getByText('Halaman 2 dari 3', { exact: true })).toBeVisible();
  await page.goto('/requests?create=1&sourceRab=missing&sourceItem=missing&q=sensor');
  await expect(page.getByRole('heading', { name: 'Akses ditolak', level: 1 })).toBeVisible();
});
test('invoice menyimpan nominal asli, tanggal dan kolom ekspor; warna ekspor konsisten', async ({
  page,
}) => {
  await login(page);
  await page.goto('/requests/request-2/invoice');
  await page.getByLabel('No. invoice', { exact: true }).fill('INV/2026/001');
  await page.getByLabel('Total invoice (Rp)', { exact: true }).fill('11250000.5');
  await page.getByLabel('Tanggal invoice', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Tautan invoice (opsional)').fill('https://example.test/invoice');
  await page.getByRole('button', { name: 'Simpan invoice' }).click();
  await expect(page.getByRole('main')).toContainText('Rp 11.250.001');
  await expect(page.getByRole('main')).toContainText('1 Jan 2026');
  await page.reload();
  await expect(page.getByRole('main')).toContainText('Rp 11.250.001');
  await page.goto('/requests?q=Spektrofotometer');
  const color = await page
    .getByRole('button', { name: 'Ekspor Excel' })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor Excel' }).click();
  const path = await (await event).path();
  if (!path) throw new Error('No workbook');
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path);
  expect(book.getWorksheet('Pembelian Barang')?.getCell('M2').value).toBe(11250000.5);
  expect(book.getWorksheet('Pembelian Barang')?.getCell('N2').value).toBe('2026-01-01');
  await page.goto('/requests/rab');
  expect(
    await page
      .getByRole('link', { name: 'Impor RAB', exact: true })
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(color);
});
for (const width of [1900, 1366, 768, 390, 320]) {
  test(`halaman detail dan edit dapat diakses ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 905 });
    await login(page);
    for (const path of [
      '/requests/request-2',
      '/requests/request-2/edit',
      '/requests/request-2/invoice',
      '/users/demo-pengaju',
      '/research-types/smart',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        audit.violations.filter((violation) =>
          ['serious', 'critical'].includes(violation.impact ?? ''),
        ),
      ).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`${path.replaceAll('/', '-')}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}

test('perubahan belum disimpan terlindungi saat Back dan refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await page.getByRole('link', { name: 'Manajemen Pengguna', exact: true }).click();
  await page.getByRole('link', { name: 'Tambah Pengguna', exact: true }).click();
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Belum tersimpan');
  await page.evaluate(() => history.back());
  await expect(page.getByRole('alertdialog', { name: 'Tinggalkan perubahan?' })).toBeVisible();
  await page.getByRole('button', { name: 'Tetap di halaman', exact: true }).click();
  await expect(page.getByLabel('Nama lengkap', { exact: true })).toHaveValue('Belum tersimpan');
  const beforeUnload = page.waitForEvent('dialog');
  await page.evaluate(() => window.setTimeout(() => window.location.reload(), 0));
  const prompt = await beforeUnload;
  expect(prompt.type()).toBe('beforeunload');
  await prompt.dismiss();
  await expect(page.getByLabel('Nama lengkap', { exact: true })).toHaveValue('Belum tersimpan');
  await page.getByRole('link', { name: 'Jenis Riset', exact: true }).click();
  await page.getByRole('button', { name: 'Tinggalkan perubahan', exact: true }).click();
  await expect(page).toHaveURL('/research-types');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('titik urgensi dan batang tindak lanjut membuka informasi terkait', async ({ page }) => {
  await login(page);
  await page.locator('.recharts-scatter-symbol').first().click();
  await expect(page).toHaveURL(/requests\/request-/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'pengaju');
  const bars = page.locator('.recharts-bar-rectangle path');
  const target = await bars.evaluateAll((elements) =>
    elements.findIndex((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }),
  );
  expect(target).toBeGreaterThanOrEqual(0);
  await bars.nth(target).click();
  await expect(page).toHaveURL(/requests\/request-/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test.describe('sentuhan dan teks besar', () => {
  test.use({ isMobile: true, hasTouch: true });
  test('kontrol halaman dan agenda memenuhi target sentuh pada 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await login(page);
    await page.goto('/requests/request-2/edit');
    const targets = await page
      .getByRole('main')
      .locator('button:not([disabled]), input:not([type=hidden]), [role=combobox]')
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            const box = element.getBoundingClientRect();
            return { width: box.width, height: box.height };
          })
          .filter((box) => box.width > 0),
      );
    expect(targets.every((box) => box.width >= 43.9 && box.height >= 43.9)).toBe(true);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await page.getByRole('button', { name: 'Buka menu navigasi' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu navigasi' });
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
