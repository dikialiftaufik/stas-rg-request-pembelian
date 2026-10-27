import { expect, test } from '@playwright/test';
import { choose } from './helpers';
for (const width of [1900, 390, 320]) {
  test(`urgensi memiliki semua kelompok dan label tidak bertumpuk pada ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 905 });
    await page.goto('/');
    await page.getByLabel('ID / NIM / EMAIL').fill('admin@gmail.com');
    await page.getByLabel('PASSWORD', { exact: true }).fill('admin123');
    await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();
    await page.getByRole('button', { name: 'Nanti saja' }).click();
    const panel = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Peta urgensi request', exact: true }) });
    await choose(page, panel.getByLabel('Riset peta urgensi'), 'smart');
    await expect(panel.locator('.recharts-scatter-symbol')).toHaveCount(6);
    for (const label of ['Terlambat (2)', '0–3 hari (1)', '4–7 hari (1)', 'Lebih dari 7 hari (2)'])
      await expect(panel.locator('li').filter({ hasText: label })).toBeVisible();
    const label = await panel
      .locator('text')
      .filter({ hasText: /^Hari ini$/ })
      .boundingBox();
    expect(label).not.toBeNull();
    const ticks = await panel
      .locator('text')
      .filter({ hasText: /^\d[\d.,]*\s*(?:jt|rb)$/ })
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      );
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks)
      expect(
        !label ||
          label.x + label.width <= tick.x ||
          tick.x + tick.width <= label.x ||
          label.y + label.height <= tick.y ||
          tick.y + tick.height <= label.y,
      ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await panel.screenshot({ path: test.info().outputPath(`urgency-${width}.png`) });
  });
}
