import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { choose } from './helpers';

async function signIn(page: Page, role: 'admin' | 'pengaju' = 'admin') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
  if (role === 'admin') await page.getByRole('button', { name: 'Nanti saja' }).click();
  await expect(page.locator('[data-chart-ready]').first()).toBeVisible();
}
async function openImport(page: Page) {
  await page.goto('/requests?tab=rab');
  await page.getByRole('link', { name: 'Impor RAB', exact: true }).click();
}
function blankPdf() {
  let text = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ].entries()) {
    offsets.push(Buffer.byteLength(text));
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(text);
  text += 'xref\n0 5\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) text += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(text + `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
}

test('PDF manual menampilkan pratinjau dan barang yang dapat dibaca di web', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await openImport(page);
  await page
    .getByLabel('Dokumen RAB')
    .setInputFiles({ name: 'manual.pdf', mimeType: 'application/pdf', buffer: blankPdf() });
  await expect(page.getByText('PDF menjadi dokumen sumber.', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pratinjau PDF halaman 1' })).toBeVisible();
  await page.getByLabel('Nama barang baris 1').fill('Barang manual');
  await page.getByLabel('Harga satuan baris 1').fill('100');
  await page.getByRole('button', { name: 'Konfirmasi impor' }).click();
  await expect(page.getByRole('cell', { name: 'Barang manual', exact: true })).toBeVisible();
  await page.getByText('Pratinjau dokumen sumber', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Pratinjau PDF halaman 1' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('invoice dapat dipratinjau, diganti dan dibaca Pengaju setelah refresh', async ({ page }) => {
  await signIn(page);
  await page.goto('/requests?detail=request-1');
  await page.getByRole('link', { name: 'Ubah status', exact: true }).click();
  await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
  await page.getByRole('link', { name: 'Unggah invoice' }).click();
  await page.getByLabel('No. invoice', { exact: true }).fill('INV/2026/001');
  await page.getByLabel('Total invoice (Rp)', { exact: true }).fill('12500000');
  await page.getByLabel('Tanggal invoice', { exact: true }).fill('2026-01-01');
  await page
    .getByLabel('File invoice', { exact: true })
    .setInputFiles({ name: 'rusak.png', mimeType: 'image/png', buffer: Buffer.from('rusak') });
  await page.getByRole('button', { name: 'Simpan invoice' }).click();
  await expect(page.getByRole('alert')).toContainText('valid');
  await expect(page.getByText('Invoice berhasil disimpan.', { exact: true })).toHaveCount(0);
  await page.getByLabel('File invoice', { exact: true }).setInputFiles({
    name: 'invoice.png',
    mimeType: 'image/png',
    buffer: await readFile('../../assets/img/logo-stas-rg.png'),
  });
  await page.getByLabel('Tautan invoice (opsional)').fill('https://example.test/invoice');
  await page.getByRole('button', { name: 'Simpan invoice' }).click();
  await expect(page.getByText('Invoice berhasil disimpan.', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pratinjau invoice.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Ganti invoice' }).click();
  await page.getByLabel('Tautan invoice (opsional)').fill('https://example.test/invoice-2');
  await page.getByRole('button', { name: 'Simpan invoice' }).click();
  await expect(page.getByRole('alert')).toContainText('Konfirmasikan');
  await page.getByLabel('Saya mengonfirmasi perubahan invoice aktif.').check();
  await page.getByRole('button', { name: 'Simpan invoice' }).click();
  await expect(page.getByRole('link', { name: 'Buka tautan invoice' })).toHaveAttribute(
    'href',
    'https://example.test/invoice-2',
  );
  await page.reload();
  await expect(page.getByRole('img', { name: 'Pratinjau invoice.png' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await signIn(page, 'pengaju');
  await page.goto('/requests?detail=request-1');
  await page.getByRole('link', { name: 'Lihat invoice', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Pratinjau invoice.png' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ganti invoice' })).toHaveCount(0);
});

test('impor CSV, koreksi, versi dan pengajuan dari RAB saling terhubung', async ({ page }) => {
  await signIn(page);
  await openImport(page);
  await page.getByLabel('Dokumen RAB').setInputFiles({
    name: 'sensor.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Nama barang;Jumlah;Satuan;Harga satuan;Keterangan\n"Sensor; presisi";2;set;"1.250.000,50";Riset\nBarang koreksi;0;unit;100;Perbaiki jumlah',
    ),
  });
  await expect(page.getByRole('region', { name: 'Pemetaan kolom RAB' })).toBeVisible();
  await choose(page, page.getByLabel('Riset tujuan'), 'smart');
  await page.getByRole('button', { name: 'Tinjau barang' }).click();
  await expect(page.getByRole('button', { name: 'Konfirmasi impor' })).toBeDisabled();
  await page.getByLabel('Jumlah baris 2', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Konfirmasi impor' }).click();
  await expect(page.getByRole('heading', { name: 'sensor', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sensor; presisi', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Rp 2.500.001', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke RAB', exact: true }).click();
  await page.getByRole('link', { name: 'Impor RAB', exact: true }).click();
  await page.getByLabel('Dokumen RAB').setInputFiles({
    name: 'sensor-v2.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Barang,Jumlah,Harga\nSensor terbaru,1,500'),
  });
  await page.getByRole('button', { name: 'Tinjau barang' }).click();
  await page.getByRole('button', { name: 'Konfirmasi impor' }).click();
  await expect(page.getByText(/Versi 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await signIn(page, 'pengaju');
  await page.goto('/requests?tab=rab');
  await page.getByRole('link', { name: 'Lihat barang' }).click();
  await page.getByRole('link', { name: 'Ajukan barang ini' }).click();
  await expect(page.getByLabel('Nama barang', { exact: true })).toHaveValue('Sensor terbaru');
  await expect(page.getByLabel('Satuan', { exact: true })).toHaveValue('unit');
  await page.getByRole('button', { name: 'Ajukan Request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sensor terbaru', exact: true }),
  ).toBeVisible();
});

test('XLSX multi-sheet mempertahankan angka numerik dan pembatalan tidak menyimpan RAB', async ({
  page,
}) => {
  await signIn(page);
  await openImport(page);
  const book = new ExcelJS.Workbook();
  for (const name of ['Pertama', 'Kedua']) {
    const sheet = book.addWorksheet(name);
    sheet.addRow(['Barang', 'Jumlah', 'Harga']);
    sheet.addRow([`Barang ${name}`, 1, 1250.5]);
  }
  await page.getByLabel('Dokumen RAB').setInputFiles({
    name: 'buku.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByLabel('Worksheet', { exact: true }).click();
  await page.getByRole('option', { name: 'Kedua (1 barang)' }).click();
  await page.getByRole('button', { name: 'Tinjau barang' }).click();
  await expect(page.getByLabel('Nama barang baris 1')).toHaveValue('Barang Kedua');
  await expect(page.getByLabel('Harga satuan baris 1')).toHaveValue('1250.5');
  await page.getByRole('button', { name: 'Batal impor' }).click();
  await page.getByRole('button', { name: 'Tinggalkan perubahan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Lihat barang', exact: true })).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'buku', exact: true })).toHaveCount(0);
});

test('periode URL dan Excel memakai seluruh hasil filter', async ({ page }) => {
  await signIn(page);
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toContain('logo-stas-rg');
  await page.goto('/requests?page=3');
  await page.getByRole('button', { name: 'Rentang tanggal pengajuan: Semua tanggal' }).click();
  await page.getByLabel('Dari tanggal', { exact: true }).fill('2000-01-01');
  await page.getByLabel('Sampai tanggal', { exact: true }).fill('2099-12-31');
  await page.getByRole('button', { name: 'Terapkan' }).click();
  await expect(page).toHaveURL(/from=2000-01-01/);
  await expect(page).not.toHaveURL(/page=3/);
  await page.getByRole('button', { name: 'Urutkan Total menaik' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor Excel' }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Excel tidak tersedia');
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path);
  expect(book.getWorksheet('Informasi ekspor')?.getCell('B2').value).toBe('2000-01-01');
  expect(book.getWorksheet('Pembelian Barang')?.rowCount).toBe(25);
  expect(book.getWorksheet('Pembelian Barang')?.getCell('J1').value).toBe('File invoice');
});

test.describe('layar sentuh', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('chart dan kalender aksesibel pada lebar 320 px', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Tren nilai Pembelian Barang' })).toBeVisible();
    await page.getByText('Lihat data tren', { exact: true }).click();
    await expect(
      page.getByRole('table', { name: 'Nilai pengajuan per periode' }).locator('tbody tr'),
    ).toHaveCount(8);
    await page.goto('/requests');
    await page.setViewportSize({ width: 320, height: 740 });
    await page.getByRole('button', { name: 'Rentang tanggal pengajuan: Semua tanggal' }).click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const targets = await page
      .getByRole('dialog')
      .locator('button, input')
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            const box = element.getBoundingClientRect();
            return { width: box.width, height: box.height };
          })
          .filter((box) => box.width > 0),
      );
    expect(targets.every((box) => box.width >= 43.9 && box.height >= 43.9)).toBe(true);
    await page.screenshot({ path: '.turbo/purchase-finish/calendar-320.png', fullPage: true });
  });
});
