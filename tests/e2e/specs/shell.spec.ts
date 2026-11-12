import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const WIDTHS = [360, 390, 768, 1024, 1280, 1440] as const;
const PAGES = ['/', '/pasar', '/harga'] as const;
const DESKTOP_MIN = 1024;
/** Initial JS budget per route, compressed (design §3 NFR). */
const JS_BUDGET_BYTES = 170 * 1024;

/** Collects console errors (CSP violations, hydration errors) for the whole test. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/**
 * Horizontal overflow in px, against the layout viewport (clientWidth excludes the scrollbar).
 * Fixed elements (TabBar, sticky NavBar) do not add to scrollWidth, so every element's right
 * edge is checked as well.
 */
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    let worst = document.documentElement.scrollWidth - vw;
    for (const el of document.querySelectorAll('header *, nav *, main *, footer *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('.sr-only') !== null) continue;
      worst = Math.max(worst, Math.ceil(r.right - vw), Math.ceil(-r.left));
    }
    return worst;
  });

for (const width of WIDTHS) {
  test.describe(`${String(width)} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of PAGES) {
      test(`${path}: no horizontal scroll, right navigation, no console errors`, async ({
        page,
      }) => {
        const errors = watchConsole(page);
        await page.goto(path);
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        const desktopNav = page.locator('header nav[aria-label="Navigasi utama"]');
        const tabBar = page.locator('body > nav[aria-label="Navigasi utama"]');
        if (width >= DESKTOP_MIN) {
          await expect(desktopNav).toBeVisible();
          await expect(tabBar).toBeHidden();
        } else {
          await expect(tabBar).toBeVisible();
          await expect(desktopNav).toBeHidden();
          // The fixed tab bar must not cover the end of the page.
          await page.evaluate(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
          });
          const lastText = page.locator('footer p').last();
          const textBox = await lastText.boundingBox();
          const barBox = await tabBar.boundingBox();
          expect(textBox).not.toBeNull();
          expect(barBox).not.toBeNull();
          if (textBox !== null && barBox !== null) {
            expect(textBox.y + textBox.height).toBeLessThanOrEqual(barBox.y);
          }
        }
        expect(errors).toEqual([]);
      });
    }
  });
}

test.describe('accessibility (WCAG 2.2 AA)', () => {
  for (const width of [360, 1280] as const) {
    for (const path of PAGES) {
      test(`${path} at ${String(width)} px has no axe violations`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.length.toString()}`)).toEqual([]);
      });
    }
  }

  test('the first Tab stop is the skip link, and focus is visible', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Lewati ke konten');
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  for (const [width, path] of PAGES.flatMap(
    (p) =>
      [
        [360, p],
        [1024, p],
      ] as const,
  )) {
    test(`${path}: text enlarged to 200% still fits at ${String(width)} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  for (const path of PAGES) {
    test(`${path} reflows at 320 px (WCAG 1.4.10)`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('motion', () => {
  test('Kapa animates when visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.kapa-motion').first()).toHaveAttribute('data-playing', '');
    const anim = await page
      .locator('.kapa .kapa-rig')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('kapa-bob');
  });

  test('Kapa stays still under prefers-reduced-motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const anim = await page
      .locator('.kapa .kapa-rig')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
    await expect(page.locator('.kapa-motion').first()).not.toHaveAttribute('data-playing');
    await context.close();
  });
});

test.describe('performance budget', () => {
  for (const path of PAGES) {
    test(`${path} loads at most 170 KB of compressed JavaScript`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const bytes = await page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .filter((e): e is PerformanceResourceTiming => 'initiatorType' in e)
          .filter((e) => e.initiatorType === 'script' || e.name.endsWith('.js'))
          .reduce((sum, e) => sum + e.transferSize, 0),
      );
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThanOrEqual(JS_BUDGET_BYTES);
    });
  }
});
