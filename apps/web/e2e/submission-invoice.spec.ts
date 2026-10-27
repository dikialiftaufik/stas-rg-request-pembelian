import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import ExcelJS from 'exceljs';

async function login(page: Page, role = 'admin') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
  if (role === 'admin') await page.getByRole('button', { name: 'Nanti saja' }).click();
}

test('status pengajuan edits inline with keyboard, persists and stays read-only for Pengaju', async ({
  page,
}) => {
  await login(page);
  const trigger = page.getByRole('button', {
    name: 'Status pengajuan Oscilloscope Digital: Belum diajukan',
    exact: true,
  });
  await expect(page.getByRole('columnheader', { name: 'Status pengajuan' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'No. invoice' })).toHaveCount(1);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('menuitemradio', { name: 'Belum diajukan', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('menuitemradio', { name: 'Sudah diajukan', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('Status pengajuan Oscilloscope Digital berhasil diperbarui.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Status pengajuan Oscilloscope Digital: Sudah diajukan',
      exact: true,
    }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: 'Status pengajuan Oscilloscope Digital: Sudah diajukan',
      exact: true,
    }),
  ).toBeVisible();
  await page.goto('/requests?q=Oscilloscope');
  await expect(page.getByRole('row').filter({ hasText: 'Oscilloscope Digital' })).toContainText(
    'Menunggu Persetujuan',
  );
  await page.getByRole('button', { name: 'Urutkan Status pengajuan menaik', exact: true }).click();
  await expect(page).toHaveURL(/sortBy=submissionStatus/);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'pengaju');
  const row = page.getByRole('row').filter({ hasText: 'Oscilloscope Digital' });
  await expect(row).toContainText('Sudah diajukan');
  await expect(page.getByRole('button', { name: /^Status pengajuan / })).toHaveCount(0);
  await page.goto('/requests/request-1');
  await expect(page.getByRole('main')).toContainText('Sudah diajukan');
  await expect(page.getByRole('button', { name: /^Status pengajuan / })).toHaveCount(0);
});

test('invoice number validates, keeps leading zeros and appears in table, detail and Excel', async ({
  page,
}) => {
  await login(page);
  await page.goto('/requests/request-11/invoice');
  await page.getByLabel('Total invoice (Rp)', { exact: true }).fill('3200000');
  await page.getByLabel('Tanggal invoice', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Tautan invoice (opsional)').fill('https://example.test/invoice');
  await page.getByRole('button', { name: 'Simpan invoice', exact: true }).click();
  await expect(page.getByText('Nomor invoice wajib diisi.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('No. invoice', { exact: true })).toBeFocused();
  await expect(page.getByText('Invoice berhasil disimpan.', { exact: true })).toHaveCount(0);
  await page.getByLabel('No. invoice', { exact: true }).fill('000123/INV');
  await page.getByRole('button', { name: 'Simpan invoice', exact: true }).click();
  await expect(page.getByRole('definition').filter({ hasText: '000123/INV' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('definition').filter({ hasText: '000123/INV' })).toBeVisible();
  await page.goto('/requests?q=Mikroskop');
  await expect(page.getByRole('cell', { name: '000123/INV', exact: true })).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Status pengajuan Mikroskop Digital: Belum diajukan',
      exact: true,
    })
    .click();
  await page.getByRole('menuitemradio', { name: 'Sudah diajukan', exact: true }).click();
  await page.getByRole('button', { name: 'Urutkan No. invoice menaik', exact: true }).click();
  await expect(page).toHaveURL(/sortBy=invoiceNumber/);
  await page.setViewportSize({ width: 1900, height: 905 });
  await page.screenshot({
    path: test.info().outputPath('invoice-table-desktop.png'),
    fullPage: true,
  });
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor Excel' }).click();
  const path = await (await event).path();
  if (!path) throw new Error('Workbook not available');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet('Pembelian Barang');
  expect(sheet?.getCell('O1').value).toBe('Status pengajuan');
  expect(sheet?.getCell('O2').value).toBe('Sudah diajukan');
  expect(sheet?.getCell('P1').value).toBe('No. invoice');
  expect(sheet?.getCell('P2').value).toBe('000123/INV');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'pengaju');
  await page.goto('/requests/request-11/invoice');
  await expect(page.getByRole('definition').filter({ hasText: '000123/INV' })).toBeVisible();
  await expect(page.getByLabel('No. invoice', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ganti invoice' })).toHaveCount(0);
});

test('failed inline persistence shows an error without success or data changes', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new Error('quota');
    };
  });
  await page
    .getByRole('button', {
      name: 'Status pengajuan Oscilloscope Digital: Belum diajukan',
      exact: true,
    })
    .click();
  await page.getByRole('menuitemradio', { name: 'Sudah diajukan', exact: true }).click();
  await expect(page.getByText(/Data gagal disimpan/)).toBeVisible();
  await expect(
    page.getByText('Status pengajuan Oscilloscope Digital berhasil diperbarui.', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: 'Status pengajuan Oscilloscope Digital: Belum diajukan',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: 'Status pengajuan Oscilloscope Digital: Belum diajukan',
      exact: true,
    }),
  ).toBeVisible();
});

test.describe('touch table', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('new columns stay inside the table at 320px and the status menu remains accessible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await login(page);
    await page.goto('/requests?q=Oscilloscope');
    const trigger = page.getByRole('button', {
      name: 'Status pengajuan Oscilloscope Digital: Belum diajukan',
      exact: true,
    });
    await trigger.scrollIntoViewIfNeeded();
    expect((await trigger.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    for (const item of await page.getByRole('menuitemradio').all())
      expect((await item.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath('status-320.png'), fullPage: true });
  });
});
