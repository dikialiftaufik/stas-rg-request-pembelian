import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function enterDashboard(page: Page, role: 'admin' | 'pengaju' = 'admin') {
  await page.goto('/');
  await page.getByLabel('ID / NIM / EMAIL').fill(`${role}@gmail.com`);
  await page.getByLabel('PASSWORD', { exact: true }).fill(`${role}123`);
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
  await page.waitForURL('**/dashboard');
}
test('popup pertama login mengunci latar, fokus keyboard dan dapat ditutup dengan Escape', async ({
  page,
}) => {
  await enterDashboard(page);
  const notice = page.getByRole('dialog', { name: 'Pemberitahuan Request' });
  await expect(notice).toContainText('4 request menunggu persetujuan');
  await expect(notice.locator('li')).toHaveCount(3);
  await expect(page.locator('body')).toHaveAttribute('data-scroll-locked', '1');
  const profile = page.locator('[aria-label="Buka profil"]');
  await profile.evaluate((element) => element.focus());
  await expect(profile).not.toBeFocused();
  await page.mouse.click(10, 10);
  await expect(notice).toBeVisible();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press(index > 2 ? 'Shift+Tab' : 'Tab');
    expect(await notice.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('main')).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.reload();
  await expect(notice).toHaveCount(0);
  await page.goto('/');
  await expect(page).toHaveURL('/dashboard');
  await expect(notice).toHaveCount(0);
  await page.getByRole('link', { name: 'Pembelian Barang', exact: true }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Notifikasi, 3 belum dibaca' })).toBeVisible();
});
test('X dan Nanti saja manual, login berikutnya memulai sesi pemberitahuan baru', async ({
  page,
}) => {
  await enterDashboard(page);
  await page.getByRole('button', { name: 'Tutup pemberitahuan' }).click();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await enterDashboard(page);
  await expect(page.getByRole('dialog', { name: 'Pemberitahuan Request' })).toBeVisible();
  await page.getByRole('button', { name: 'Nanti saja' }).click();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('Tinjau request membuka seluruh pending tanpa menandai semua notifikasi dibaca', async ({
  page,
}) => {
  await enterDashboard(page);
  await page.getByRole('dialog').getByRole('link', { name: 'Tinjau request', exact: true }).click();
  await expect(page).toHaveURL('/requests?status=pending_review');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Notifikasi, 3 belum dibaca' })).toBeVisible();
});
test('Pengaju dan sesi tanpa request pending tidak mendapat popup', async ({ page }) => {
  await enterDashboard(page, 'pengaju');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stas-rg-demo-v1');
    if (!raw) throw new Error('Data tidak tersedia');
    const data = JSON.parse(raw) as { requests: { status: string }[] };
    data.requests.forEach((request) => {
      request.status = 'approved';
    });
    sessionStorage.setItem('stas-rg-demo-v1', JSON.stringify(data));
  });
  await enterDashboard(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
for (const viewport of [
  { width: 1900, height: 905 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`popup sekali per sesi ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await enterDashboard(page);
    const notice = page.getByRole('dialog', { name: 'Pemberitahuan Request' });
    await expect(notice).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const bounds = await notice.boundingBox();
    if (!bounds) throw new Error('Popup tidak terlihat');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeLessThanOrEqual(viewport.height);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    const screenshot = testInfo.outputPath(`popup-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, animations: 'disabled' });
    await testInfo.attach('Popup Admin', { path: screenshot, contentType: 'image/png' });
    await notice.getByRole('button', { name: 'Tutup pemberitahuan' }).click();
  });
}
