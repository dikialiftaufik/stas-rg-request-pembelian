import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login dapat digunakan dengan keyboard tanpa autentikasi palsu', async ({ page }) => {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType())) apiRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Masuk | STAS-RG Procurement Portal');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Selamat datang kembali.');
  const logo = page.getByRole('img', { name: 'STAS Research Group' });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty('naturalWidth', 1254);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Langsung ke konten' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('ID / NIM / EMAIL')).toBeFocused();
  await page.keyboard.type('STAS-001');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('PASSWORD', { exact: true })).toBeFocused();
  await page.keyboard.type(' password ');
  await page.keyboard.press('Tab');
  const toggle = page.getByRole('button', { name: 'Tampilkan password' });
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('PASSWORD', { exact: true })).toHaveAttribute('type', 'text');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(page.getByLabel('PASSWORD', { exact: true })).toHaveAttribute('type', 'password');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Masuk ke Dashboard' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Fitur masuk belum tersedia saat ini.');
  await expect(page.getByLabel('PASSWORD', { exact: true })).toHaveValue(' password ');
  await expect(page).toHaveURL('/');
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => [window.localStorage.length, window.sessionStorage.length]),
  ).toEqual([0, 0]);
});

test('validasi form menjelaskan kesalahan dan memfokuskan input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await expect(page.getByText('Masukkan ID, NIM, atau email Anda.')).toBeVisible();
  await expect(page.getByText('Masukkan password Anda.')).toBeVisible();
  await expect(page.getByLabel('ID / NIM / EMAIL')).toBeFocused();
  await page.getByLabel('ID / NIM / EMAIL').fill('peneliti@example.com');
  await expect(page.getByText('Masukkan ID, NIM, atau email Anda.')).toHaveCount(0);
  await page.getByLabel('PASSWORD', { exact: true }).fill('password');
  await page.getByLabel('PASSWORD', { exact: true }).press('Enter');
  await expect(page.getByRole('status')).toHaveText('Fitur masuk belum tersedia saat ini.');
});

test('rute tentang dan halaman tidak ditemukan tetap berfungsi', async ({ page }) => {
  await page.goto('/tentang');
  await expect(page.getByRole('heading', { name: 'Tentang workspace' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tentang workspace' })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke beranda' }).click();
  await expect(page.getByLabel('ID / NIM / EMAIL')).toBeVisible();
  await page.goto('/tidak-ada');
  await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke beranda' }).click();
  await expect(page.getByLabel('ID / NIM / EMAIL')).toBeVisible();
});

for (const viewport of [
  { width: 1917, height: 910 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`tampilan login ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const brandPanel = page.locator('aside');
    if (viewport.width >= 1024) {
      await expect(brandPanel).toBeVisible();
    } else {
      await expect(brandPanel).toBeHidden();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await expect(page.getByRole('img', { name: 'STAS Research Group' })).toBeVisible();
    const screenshot = testInfo.outputPath(`login-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
    await testInfo.attach('Tampilan login', { path: screenshot, contentType: 'image/png' });
    await page.getByRole('button', { name: 'Masuk ke Dashboard' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Masuk ke Dashboard' })).toBeInViewport();
  });
}

test('form tetap dapat dipakai ketika ukuran teks diperbesar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel('ID / NIM / EMAIL').fill('2026123456');
  await page.getByLabel('PASSWORD', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await expect(page.getByRole('status')).toHaveText('Fitur masuk belum tersedia saat ini.');
});

test('login memenuhi pemeriksaan aksesibilitas pada desktop, mobile, dan state error', async ({
  page,
}) => {
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    for (const invalid of [false, true]) {
      if (invalid) await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  }
});
