// Every page in site.config.js, plus the site's own pages: it draws, every generated sentence
// is filled with real words, axe finds no WCAG 2.2 AA violations, nothing scrolls sideways, and
// the console stays quiet. Passes on fixture data and on the full data.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import site from '../site.config.js';
import { clickNav } from './nav.js';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** Signs a sentence was built from a missing value. */
const BROKEN = /undefined|NaN|null|Infinity|\[object/;

async function checkClean(page, errors) {
  await page.locator('details').evaluateAll((all) => all.forEach((d) => (d.open = true)));
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
}

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test('the home page links to every page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.name);
  for (const p of site.pages) await expect(page.getByRole('link', { name: p.title, exact: true })).toBeVisible();
  await checkClean(page, errors);
});

test('the About page lists every source', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await clickNav(page, 'About');
  await expect(page).toHaveURL(/about\.html$/);
  for (const s of Object.values(site.sources)) await expect(page.locator('main').getByText(s.title, { exact: true })).toBeVisible();
  await checkClean(page, errors);
});

for (const p of site.pages) {
  test(`${p.title}: draws, every sentence is filled, and it is accessible`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`./${p.file}`);
    await expect(page.getByRole('heading', { name: p.title, level: 1 })).toBeVisible();
    await expect(page.locator(p.ready).first()).toBeAttached();
    await expect(page.locator('#error')).toBeHidden();
    for (const h of await page.locator('main h2:not(.govuk-error-summary__title)').all()) await expect(h).not.toBeEmpty();
    for (const s of await page.locator('[id$="-summary"]').all()) {
      const text = (await s.textContent()).trim();
      if (text) expect(text, `${await s.getAttribute('id')}`).not.toMatch(BROKEN);
    }
    await checkClean(page, errors);
  });
}
