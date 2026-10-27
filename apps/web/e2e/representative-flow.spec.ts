import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, role: 'admin' | 'pengaju') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
  if (role === 'admin') await page.getByRole('button', { name: 'Nanti saja' }).click();
}
test('RAB contoh tersedia bagi Admin dan hanya riset perwakilan bagi Pengaju', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/requests/rab');
  await expect(page.getByRole('link', { name: 'Lihat barang', exact: true })).toHaveCount(6);
  await page.goto('/requests/rab/demo-rab-smart');
  await expect(page.getByRole('cell', { name: 'Sensor tekanan FSR', exact: true })).toBeVisible();
  await page.getByText('Pratinjau dokumen sumber', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Unduh RAB-smart.csv' })).toBeVisible();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, 'pengaju');
  await page.goto('/requests/rab');
  await expect(page.getByRole('link', { name: 'Lihat barang', exact: true })).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'RAB Smart Mannequin', exact: true }),
  ).toBeVisible();
  await page.goto('/requests/new');
  await expect(page.getByLabel('Jenis riset', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Smart Mannequin', { exact: true })).toBeVisible();
  await page.getByLabel('Sumber pengajuan', { exact: true }).click();
  await page
    .getByRole('option', { name: 'Dari RAB · pilih barang terdaftar', exact: true })
    .click();
  await expect(page.getByText('Pilih RAB aktif untuk riset Anda.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajukan Request', exact: true }).click();
  await expect(page.getByLabel('Dokumen RAB', { exact: true })).toBeFocused();
  await page.getByLabel('Dokumen RAB', { exact: true }).click();
  await page.getByRole('option', { name: 'RAB Smart Mannequin · Versi 1', exact: true }).click();
  await page.getByLabel('Barang dalam RAB', { exact: true }).click();
  await page.getByRole('option', { name: 'Sensor tekanan FSR', exact: true }).click();
  await expect(page.getByLabel('Nama barang', { exact: true })).toHaveValue('Sensor tekanan FSR');
  await expect(page.getByLabel('Nama barang', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByLabel('Jumlah', { exact: true }).fill('2');
  await expect(page.locator('output')).toContainText('Rp 370.000');
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Ajukan Request', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sensor tekanan FSR', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Lihat barang RAB', exact: true })).toBeVisible();
  await page.goto('/requests/rab/demo-rab-weather');
  await expect(page.getByRole('heading', { level: 1, name: 'RAB tidak tersedia' })).toBeVisible();
});
