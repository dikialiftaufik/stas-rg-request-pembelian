import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('halaman build berjalan, navigasi dan notifikasi dapat dipakai', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Frontend STAS-RG siap' })).toBeVisible();
  await page.getByRole('button', { name: 'Uji notifikasi' }).click();
  await expect(page.getByText('Notifikasi frontend bekerja.')).toBeVisible();
  await page.getByRole('link', { name: 'Tentang workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Tentang workspace' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tentang workspace' })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke beranda' }).click();
  await expect(page.getByRole('heading', { name: 'Frontend STAS-RG siap' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('halaman awal tidak memiliki temuan aksesibilitas serius atau critical', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((issue) => issue.impact === 'critical' || issue.impact === 'serious'),
  ).toEqual([]);
});
