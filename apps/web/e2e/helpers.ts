import type { Page, Locator } from '@playwright/test';
const labels = new Map([
  ['pending_review', 'Menunggu Persetujuan'],
  ['approved', 'Disetujui'],
  ['ordered', 'Sudah Dipesan'],
  ['in_transit', 'Dalam Pengiriman'],
  ['delivered', 'Diterima'],
  ['completed', 'Selesai'],
  ['rejected', 'Ditolak'],
  ['smart', 'Smart Mannequin'],
  ['admin', 'Admin'],
  ['pengaju', 'Pengaju'],
]);
export async function choose(page: Page, trigger: Locator, value: string) {
  const empty =
    (await trigger.getAttribute('aria-label')) === 'Filter status' ? 'Semua status' : 'Semua riset';
  await trigger.click();
  await page
    .getByRole('option', { name: value ? (labels.get(value) ?? value) : empty, exact: true })
    .click();
}
