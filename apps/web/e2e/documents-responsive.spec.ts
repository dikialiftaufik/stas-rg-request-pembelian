import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

for (const viewport of [
  { width: 1900, height: 905 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`dokumen dan periode dapat digunakan ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByLabel('ID / NIM / EMAIL').fill('admin@gmail.com');
    await page.getByLabel('PASSWORD', { exact: true }).fill('admin123');
    await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
    await page.getByRole('button', { name: 'Nanti saja' }).click();
    await page.goto('/requests?tab=rab');
    await page.getByRole('link', { name: 'Impor RAB', exact: true }).click();
    await page.getByLabel('Dokumen RAB').setInputFiles({
      name: 'RAB-instrumentasi-laboratorium.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Barang,Jumlah,Satuan,Harga,Keterangan\nSensor instrumentasi laboratorium presisi tinggi untuk penelitian jangka panjang,2,set,1250000,Dokumen contoh\nPerangkat kalibrasi,1,unit,500000,',
      ),
    });
    await page.getByLabel('Worksheet', { exact: true }).waitFor();
    await page.getByLabel('Riset tujuan').click();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Riset tujuan')).toBeFocused();
    await page.getByRole('button', { name: 'Tinjau barang' }).click();
    let dialog = page.getByRole('main');
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const reviewAudit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      reviewAudit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.turbo/purchase-finish/rab-review-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Konfirmasi impor' }).click();
    await expect(page.getByRole('region', { name: 'Daftar barang RAB' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.turbo/purchase-finish/rab-items-${viewport.width}.png`,
      fullPage: true,
    });
    await page.goto('/requests?detail=request-2');
    await page.getByRole('link', { name: 'Unggah invoice' }).click();
    await page.getByLabel('No. invoice', { exact: true }).fill('INV/2026/001');
    await page.getByLabel('Total invoice (Rp)', { exact: true }).fill('12000000');
    await page.getByLabel('Tanggal invoice', { exact: true }).fill('2026-01-01');
    await page.getByLabel('File invoice', { exact: true }).setInputFiles({
      name: 'invoice.png',
      mimeType: 'image/png',
      buffer: await readFile('../../assets/img/logo-stas-rg.png'),
    });
    await page.getByRole('button', { name: 'Simpan invoice' }).click();
    await expect(page.getByRole('img', { name: 'Pratinjau invoice.png' })).toBeVisible();
    dialog = page.getByRole('main');
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const invoiceAudit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      invoiceAudit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.turbo/purchase-finish/invoice-${viewport.width}.png`,
      fullPage: true,
    });
    if (viewport.width === 390) {
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: '.turbo/purchase-finish/invoice-text-200.png',
        fullPage: true,
      });
    }
    await page.keyboard.press('Escape');
    await page.goto('/requests');
    await page.getByRole('button', { name: 'Rentang tanggal pengajuan: Semua tanggal' }).click();
    await expect(page.getByRole('button', { name: 'Terapkan', exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.turbo/purchase-finish/period-${viewport.width}.png`,
      fullPage: true,
    });
  });
}
