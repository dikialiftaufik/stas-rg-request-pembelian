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

test('hard popup memblokir aksi, Escape, klik backdrop, dan scroll halaman', async ({ page }) => {
  await enterDashboard(page);
  const notice = page.getByRole('alertdialog', { name: 'Pemberitahuan Request' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('1 dari 3');
  await expect(notice).toContainText('Persetujuan diperlukan: Oscilloscope Digital');
  await expect(notice).toContainText('Rp 12.500.000');
  await expect(notice.getByRole('heading', { level: 3 })).toBeFocused();
  expect(await notice.evaluate((element) => element.matches(':modal'))).toBe(true);
  const search = page.locator('input[aria-label="Cari request"]');
  await search.evaluate((element) => element.focus());
  await expect(search).not.toBeFocused();
  const profile = await page.getByRole('button', { name: 'Buka profil' }).boundingBox();
  if (!profile) throw new Error('Tombol profil tidak ditemukan');
  await page.mouse.click(profile.x + profile.width / 2, profile.y + profile.height / 2);
  await expect(page.getByRole('dialog', { name: 'Profil Pengguna' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(notice).toBeVisible();
  await page.mouse.click(16, 16);
  await expect(notice).toBeVisible();
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await notice.getByRole('heading', { level: 3 }).focus();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab');
    expect(await notice.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await notice.getByRole('button', { name: 'Nanti saja' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('main')).toBeFocused();
  await search.fill('Oscilloscope');
  await expect(search).toHaveValue('Oscilloscope');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('X menutup manual, kunjungan ulang dan refresh menampilkan popup kembali', async ({
  page,
}) => {
  await enterDashboard(page);
  const notice = page.getByRole('alertdialog', { name: 'Pemberitahuan Request' });
  await notice.getByRole('button', { name: 'Tutup pemberitahuan' }).click();
  await page.getByRole('link', { name: 'Request Pembelian', exact: true }).click();
  await expect(notice).toHaveCount(0);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Nanti saja' }).click();
  await page.reload();
  await expect(notice).toBeVisible();
});

test('Tinjau Request membuka detail yang tepat dan dialog biasa masih mendukung Escape', async ({
  page,
}) => {
  await enterDashboard(page);
  await page.getByRole('button', { name: 'Tinjau Request', exact: true }).click();
  await expect(page).toHaveURL('/requests?detail=request-1');
  const detail = page.getByRole('dialog', { name: 'Detail Request Pembelian' });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('Oscilloscope Digital');
  await expect(detail).toContainText('Ir. Citra Dewi');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Notifikasi, 2 belum dibaca' })).toBeVisible();
});

test('dashboard Pengaju tidak menampilkan hard popup', async ({ page }) => {
  await enterDashboard(page, 'pengaju');
  await expect(
    page.getByRole('heading', { name: 'Dashboard Pengadaan', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Cari request' }).fill('Oscilloscope');
});

test('keadaan kosong tidak mengarang pemberitahuan dan tetap memerlukan penutupan manual', async ({
  page,
}) => {
  await enterDashboard(page);
  await page.getByRole('button', { name: 'Nanti saja' }).click();
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stas-rg-demo-v1');
    if (!raw) throw new Error('Data demo tidak tersedia');
    const data = JSON.parse(raw) as { requests: { status: string }[] };
    data.requests.forEach((request) => {
      request.status = 'approved';
    });
    sessionStorage.setItem('stas-rg-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  const notice = page.getByRole('alertdialog');
  await expect(notice).toContainText('Tidak ada request menunggu persetujuan');
  await expect(notice).not.toContainText('1 dari 0');
  await notice.getByRole('button', { name: 'Lanjut ke Dashboard' }).click();
  await expect(notice).toHaveCount(0);
});

for (const viewport of [
  { width: 1672, height: 941 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`hard popup ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await enterDashboard(page);
    const notice = page.getByRole('alertdialog', { name: 'Pemberitahuan Request' });
    await expect(notice).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const bounds = await notice.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error('Popup tidak terlihat');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(await notice.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    const screenshot = testInfo.outputPath(`hard-popup-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: screenshot, animations: 'disabled' });
    await testInfo.attach('Hard popup Admin', { path: screenshot, contentType: 'image/png' });
    await notice.getByRole('button', { name: 'Tutup pemberitahuan' }).click();
    await expect(
      page.getByRole('heading', { name: 'Dashboard Pengadaan', exact: true }),
    ).toBeVisible();
  });
}
