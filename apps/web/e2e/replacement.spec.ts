import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';

async function login(page: Page, role = 'admin') {
  await page.setViewportSize({ width: 1900, height: 905 });
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
  if (role === 'admin') await page.getByRole('button', { name: 'Nanti saja' }).click();
}
async function switchAccount(page: Page, role: string) {
  await page.setViewportSize({ width: 1900, height: 905 });
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, role);
}
async function screenshots(page: Page, state: string) {
  for (const width of [1900, 1366, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 905 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const branch = page.getByRole('region', { name: 'Penawaran pengganti', exact: true });
    if (await branch.count()) {
      const bounds = await branch.boundingBox();
      expect(bounds?.width).toBeGreaterThan(150);
      expect(bounds?.height).toBeLessThan(1000);
    }
    await page.screenshot({
      path: test.info().outputPath(`${state}-${width}.png`),
      fullPage: true,
    });
  }
}
test('replacement branch pauses, rejects, retries and resumes only after owner acceptance', async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  await page.goto('/requests/request-19');
  await expect(page.getByRole('heading', { name: 'Proses pembelian', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Informasi pengiriman', exact: true }),
  ).toHaveCount(0);
  await screenshots(page, 'normal');
  await page.getByRole('link', { name: 'Ajukan link pengganti', exact: true }).click();
  await page
    .getByLabel('Tautan pengganti', { exact: true })
    .fill('https://example.test/barang-baru');
  await page.getByLabel('Harga satuan pengganti (Rp)', { exact: true }).fill('5000000');
  await page
    .getByLabel('Alasan penggantian', { exact: true })
    .fill('Barang lama habis, penjual menawarkan tautan baru.');
  await page.getByRole('button', { name: 'Kirim untuk ditinjau Pengaju' }).click();
  await expect(page.getByRole('main')).toContainText('Menunggu tinjauan Pengaju');
  await expect(page.getByRole('link', { name: 'Ubah status', exact: true })).toHaveCount(0);
  await page.reload();
  await screenshots(page, 'pending');
  await switchAccount(page, 'pengaju');
  await page.goto('/requests/request-19/replacement');
  await page.getByRole('button', { name: 'Minta alternatif lain', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('alasan');
  await page
    .getByLabel('Alasan meminta alternatif lain (wajib jika tidak setuju)')
    .fill('Perlu garansi resmi.');
  await page.getByRole('button', { name: 'Minta alternatif lain', exact: true }).click();
  await screenshots(page, 'rejected');
  await switchAccount(page, 'admin');
  await page.goto('/requests/request-19/replacement');
  await page
    .getByLabel('Tautan pengganti', { exact: true })
    .fill('https://example.test/garansi-resmi');
  await page.getByLabel('Harga satuan pengganti (Rp)', { exact: true }).fill('4900000');
  await page
    .getByLabel('Alasan penggantian', { exact: true })
    .fill('Alternatif dengan garansi resmi.');
  await page.getByRole('button', { name: 'Kirim untuk ditinjau Pengaju' }).click();
  await switchAccount(page, 'pengaju');
  await page.goto('/requests/request-19/replacement');
  await page.getByRole('button', { name: 'Setujui penawaran', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('Rp 4.900.000');
  await screenshots(page, 'accepted');
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/requests/request-3/replacement');
  await expect(page.getByRole('button', { name: 'Setujui penawaran' })).toHaveCount(0);
  await switchAccount(page, 'admin');
  await page.goto('/requests/request-19/status');
  await page.getByRole('button', { name: 'Konfirmasi perubahan status' }).click();
  await expect(page.locator('li[aria-current="step"]').first()).toContainText('Sudah Dipesan');
  await page.goto('/requests/request-19/delivery?returnTo=%2Frequests%3Fpage%3D2');
  await expect(page).toHaveURL(/\/requests\/request-19\?returnTo=/);
});

for (const kind of ['xlsx', 'docx'])
  test(`Admin uploads ${kind}; owner downloads original bytes after refresh`, async ({ page }) => {
    let bytes: Buffer;
    if (kind === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Invoice').addRow(['Invoice', 5000000]);
      bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    } else {
      const zip = new JSZip();
      zip.file(
        '[Content_Types].xml',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      );
      zip.file(
        'word/document.xml',
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
      );
      bytes = await zip.generateAsync({ type: 'nodebuffer' });
    }
    await login(page);
    await page.goto('/requests/request-12/invoice');
    await page.getByLabel('No. invoice', { exact: true }).fill('INV-0001');
    await page.getByLabel('Total invoice (Rp)', { exact: true }).fill('5000000');
    await page.getByLabel('Tanggal invoice', { exact: true }).fill('2026-01-01');
    await page.getByLabel('File invoice', { exact: true }).setInputFiles({
      name: `invoice.${kind}`,
      mimeType: 'application/octet-stream',
      buffer: bytes,
    });
    await page.getByRole('button', { name: 'Simpan invoice' }).click();
    await expect(page.getByRole('link', { name: 'Unduh invoice', exact: true })).toBeVisible();
    await switchAccount(page, 'pengaju');
    await page.goto('/requests/request-12/invoice');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ganti invoice' })).toHaveCount(0);
    const event = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Unduh invoice', exact: true }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe(`invoice.${kind}`);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    if (!stream) throw new Error('Download stream unavailable');
    for await (const chunk of stream) {
      if (!(chunk instanceof Uint8Array)) throw new Error('Invalid download bytes');
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks)).toEqual(bytes);
  });
