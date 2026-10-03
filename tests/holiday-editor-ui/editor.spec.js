import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { holidays, seed, selectHoliday, more, mockTrmnl } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.iconify.design/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/search') return route.fulfill({ json: { icons: ['fluent:calendar-20-regular'] } });
    const icons = Object.fromEntries((url.searchParams.get('icons') || '').split(',').map(name => [name, { body: '<path fill="currentColor" d="M3 4h14v13H3z"/>' }]));
    await route.fulfill({ json: { prefix: url.pathname.slice(1).replace('.json', ''), width: 20, height: 20, icons } });
  });
});

for (const destination of ['manual', 'trmnl']) {
  test(`${destination} action menu has consistent hover and keyboard focus in both themes`, async ({ page }) => {
    await seed(page, { session: destination === 'trmnl' });
    if (destination === 'trmnl') await mockTrmnl(page);
    await page.goto(`/holiday-editor/#${destination === 'trmnl' ? 'trmnl/1' : 'manual'}`);
    const summary = page.locator('.action-menu > summary');
    await summary.click();
    const menu = page.locator('.action-menu-content');
    const actions = menu.locator('button, a[role="button"]');
    await expect(actions).toHaveCount(4);
    for (const theme of ['dark', 'light']) {
      await page.getByLabel('Appearance').selectOption(theme);
      await summary.hover();
      await summary.focus();
      const highlight = await page.locator('.holiday-row.selected').evaluate(element => getComputedStyle(element).backgroundColor);
      for (const action of await actions.all()) {
        await expect(action).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(action).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
        await action.hover();
        await expect(action).toHaveCSS('background-color', highlight);
        await expect(action).toHaveCSS('filter', 'none');
        await summary.hover();
      }
      await summary.focus();
      await page.keyboard.press('Tab');
      for (const action of await actions.all()) {
        await action.focus();
        await expect(action).toBeFocused();
        await expect(action).toHaveCSS('background-color', highlight);
        await expect(action).toHaveCSS('outline-style', 'solid');
        await expect(action).toHaveCSS('outline-width', '3px');
      }
      if (destination === 'manual') {
        const dangerColor = await menu.locator('.danger-text').evaluate(element => getComputedStyle(element).color);
        const normalColor = await actions.first().evaluate(element => getComputedStyle(element).color);
        expect(dangerColor).not.toBe(normalColor);
      }
    }
  });
}

test('disabled action-menu items stay inactive on hover', async ({ page }) => {
  await seed(page, { session: true });
  await mockTrmnl(page);
  await page.goto('/holiday-editor/#trmnl/1');
  await expect(page.getByLabel('Upcoming holiday to display', { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('trmnl-holiday-editor:session', JSON.stringify({ type: 'oauth', accessToken: 'fixture-token', scope: 'read', expiresAt: Date.now() + 100000 })));
  await page.reload();
  await page.locator('.action-menu > summary').click();
  const copy = page.locator('.action-menu-content').getByRole('button', { name: /Copy to other plugins/ });
  await expect(copy).toBeDisabled();
  await copy.hover();
  await expect(copy).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(copy).toHaveCSS('filter', 'none');
  await expect(copy).toHaveCSS('opacity', '0.5');
});

test('onboarding supports templates, local creation, and connected sign-in', async ({ page }) => {
  await seed(page, { draft: null });
  await page.goto('/holiday-editor/');
  await page.getByRole('link', { name: /Edit local list/ }).click();
  await expect(page.getByRole('heading', { name: 'Local editor' })).toBeVisible();
  await page.getByRole('button', { name: /Start fresh/ }).click();
  await page.getByLabel('Holiday name', { exact: true }).fill('Birthday');
  await page.getByText('Holiday icon', { exact: false }).click();
  await page.getByLabel('Icon identifier').fill('fluent:calendar-20-regular');
  await expect(page.getByText('Saved in this browser')).toBeVisible();
  await page.reload();
  await selectHoliday(page, 'Birthday');
  await expect(page.getByLabel('Holiday name', { exact: true })).toHaveValue('Birthday');
  await page.getByRole('link', { name: 'My plugins', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect with TRMNL', exact: true })).toBeVisible();
  await expect(page.getByLabel('Account API key')).toBeVisible();
});

test('landing and navigation prioritize TRMNL and align the Iconify-based desktop header', async ({ page }) => {
  await seed(page, { draft: null });
  await page.goto('/holiday-editor/');
  await expect(page.locator('.connection-primary').getByRole('button', { name: 'Connect with TRMNL', exact: true })).toBeVisible();
  await expect(page.locator('.connection-secondary').getByRole('link', { name: /Use an API key instead/ })).toHaveAttribute('href', '#trmnl');
  await expect(page.locator('.connection-secondary').getByRole('link', { name: /Edit local list/ })).toHaveAttribute('href', '#manual');
  await expect(page.locator('.landing-note').getByRole('link', { name: 'Explore the guide', exact: true })).toHaveAttribute('href', '#reference');
  await expect(page.getByLabel('Account API key')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link').first()).toHaveAttribute('href', '#trmnl');
  await expect(page.locator('.app-title iconify-icon')).toHaveAttribute('icon', 'fluent:calendar-24-regular');
  await expect(page.locator('.entry-icon iconify-icon')).toHaveCount(3);
  expect(await page.evaluate(() => document.querySelectorAll('.app-title svg, .entry-icon svg').length)).toBe(0);
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const centers = await page.evaluate(() => ['.app-title', '.app-header nav', '.theme-control select'].map(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return box.y + box.height / 2;
    }));
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  }
});

test('sign-in cards use TRMNL and key icons and have equal heights side by side', async ({ page }) => {
  await seed(page, { draft: null });
  await page.goto('/holiday-editor/');
  await expect(page.locator('.connection-primary iconify-icon')).toHaveAttribute('icon', 'simple-icons:trmnl');
  const apiLink = page.getByRole('link', { name: /Use an API key instead/ });
  await expect(apiLink.locator('iconify-icon')).toHaveAttribute('icon', 'fluent:key-24-regular');
  await apiLink.click();
  await expect(page.locator('.signin-options .connection-primary iconify-icon')).toHaveAttribute('icon', 'simple-icons:trmnl');
  await expect(page.locator('.api-key-panel iconify-icon')).toHaveAttribute('icon', 'fluent:key-24-regular');
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const fontSize of ['16px', '32px']) {
      await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
      const oauth = await page.locator('.signin-options .connection-primary').boundingBox();
      const apiKey = await page.locator('.api-key-panel').boundingBox();
      expect(apiKey.x).toBeGreaterThan(oauth.x);
      expect(Math.abs(apiKey.y - oauth.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(apiKey.height - oauth.height)).toBeLessThanOrEqual(1);
    }
  }
});

test('landing OAuth action starts PKCE directly and returns to connected editing', async ({ page }) => {
  await seed(page, { draft: null });
  await page.route('https://trmnl.com/oidc/authorize**', route => route.fulfill({ contentType: 'text/html', body: '<title>Fixture authorization</title>' }));
  await page.goto('/trmnl-recipes/holiday-editor/');
  await expect(page.getByLabel('Account API key')).not.toBeVisible();
  await page.getByRole('button', { name: 'Connect with TRMNL', exact: true }).click();
  await page.waitForURL('https://trmnl.com/oidc/authorize**');
  const authorization = new URL(page.url());
  expect(authorization.searchParams.get('response_type')).toBe('code');
  expect(authorization.searchParams.get('scope')).toBe('read content');
  expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
  expect(authorization.searchParams.get('code_challenge')).toHaveLength(43);
  expect(authorization.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:4173/trmnl-recipes/holiday-editor/callback.html');
  await page.goto('/trmnl-recipes/holiday-editor/');
  const pending = await page.evaluate(() => JSON.parse(sessionStorage.getItem('trmnl-holiday-editor:pkce')));
  expect(pending.returnHash).toBe('#trmnl');
  expect(pending.state).toBe(authorization.searchParams.get('state'));
});

test('landing OAuth setup failures stay visible and leave secondary editing available', async ({ page }) => {
  await seed(page, { draft: null });
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'trmnl-holiday-editor:pkce') throw new Error('Authorization setup could not be saved');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/holiday-editor/');
  await page.getByRole('button', { name: 'Connect with TRMNL', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Authorization setup could not be saved');
  await expect(page.getByRole('button', { name: 'Connect with TRMNL', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: /Edit local list/ }).click();
  await expect(page.getByRole('heading', { name: 'How would you like to start?' })).toBeVisible();
});

test('secondary API-key login updates the landing primary action and preserves the local draft', async ({ page }) => {
  await seed(page);
  const api = await mockTrmnl(page);
  api.state.unauthorized = true;
  await page.goto('/holiday-editor/');
  await expect(page.getByLabel('Account API key')).toHaveCount(0);
  await page.getByRole('link', { name: /Use an API key instead/ }).click();
  await expect(page).toHaveURL(/#trmnl$/);
  await expect(page.getByLabel('Account API key')).toBeVisible();
  await page.getByLabel('Account API key').fill('fixture-token');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('That API key was rejected by TRMNL.');
  await expect(page.getByRole('button', { name: 'Connect with TRMNL', exact: true })).toBeVisible();
  api.state.unauthorized = false;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your holiday plugins' })).toBeVisible();
  await page.getByRole('link', { name: 'Holiday Editor home', exact: true }).click();
  const open = page.locator('.connection-primary').getByRole('link', { name: 'Open my plugins', exact: true });
  await expect(open).toHaveAttribute('href', '#trmnl');
  await expect(page.getByRole('link', { name: /Use an API key instead/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Edit local list/ })).toContainText('Continue your draft');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trmnl-holiday-editor')));
  expect(saved).toEqual(holidays);
  await open.click();
  await expect(page.getByRole('heading', { name: 'Your holiday plugins' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('link', { name: 'Holiday Editor home', exact: true }).click();
  await expect(page.locator('.connection-primary').getByRole('button', { name: 'Connect with TRMNL', exact: true })).toBeVisible();
});

test('signed-in landing prioritizes direct editing for OAuth and API-key sessions', async ({ page }) => {
  await seed(page, { session: true });
  await page.goto('/holiday-editor/');
  await expect(page.locator('.connection-primary').getByRole('link', { name: 'Open my plugins', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect with TRMNL', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const key = 'trmnl-holiday-editor:session';
    localStorage.setItem(key, JSON.stringify({ type: 'oauth', accessToken: 'fixture-token', scope: 'read content', expiresAt: Date.now() + 100000 }));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
  await expect(page.locator('.connection-primary').getByRole('link', { name: 'Open my plugins', exact: true })).toBeVisible();
  await expect(page.getByLabel('Account API key')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Use an API key instead/ })).toHaveCount(0);
  const guide = page.locator('.landing-note').getByRole('link', { name: 'Explore the guide', exact: true });
  await expect(guide).toBeVisible();
  await guide.click();
  await expect(page.getByRole('heading', { name: 'Guide & reference', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Holiday Editor home', exact: true }).click();
  await page.getByRole('link', { name: /Edit local list/ }).click();
  await expect(page.getByRole('heading', { name: 'Local editor', exact: true })).toBeVisible();
});

test('landing pathways remain accessible and reflow in both themes and session states', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/');
  async function checkReflow() {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const fontSize of ['16px', '32px']) {
        await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
        expect(await page.evaluate(width => document.documentElement.scrollWidth <= width, width)).toBe(true);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
  }
  for (const signedIn of [false, true]) {
    if (signedIn) await page.evaluate(() => {
      const key = 'trmnl-holiday-editor:session';
      localStorage.setItem(key, JSON.stringify({ type: 'apikey', accessToken: 'fixture-token' }));
      window.dispatchEvent(new StorageEvent('storage', { key }));
    });
    for (const theme of ['dark', 'light']) {
      await page.getByLabel('Appearance').selectOption(theme);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
      await checkReflow();
    }
  }
  await page.evaluate(() => {
    const key = 'trmnl-holiday-editor:session';
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
  await page.getByRole('link', { name: /Use an API key instead/ }).click();
  await expect(page.getByLabel('Account API key')).toBeVisible();
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Appearance').selectOption(theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await checkReflow();
  }
});

test('invalid fields and collapsed summaries stay visible and the header icon focuses its editor', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await selectHoliday(page, 'Christmas');
  const name = page.getByLabel('Holiday name', { exact: true });
  const icon = page.getByLabel('Icon identifier', { exact: true });
  const iconButton = page.getByRole('button', { name: 'Edit holiday icon', exact: true });
  const iconSummary = page.locator('.settings-section > summary').filter({ hasText: /^Holiday icon/ });
  await name.fill('');
  await iconButton.click();
  await expect(icon).toBeFocused();
  await expect(iconButton).toHaveAttribute('aria-expanded', 'true');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveCSS('outline-width', '2px');
  await icon.fill('');
  await iconSummary.click();
  await expect(iconSummary.locator('.invalid-summary')).toHaveText('Icon required');
  await expect(iconSummary.locator('..')).not.toHaveAttribute('open', '');
  await iconButton.focus();
  await page.keyboard.press('Enter');
  await expect(icon).toBeFocused();
  await expect(icon).toHaveAttribute('aria-invalid', 'true');
  await expect(icon).toHaveCSS('outline-width', '2px');
  const errorColors = await page.evaluate(() => {
    const field = document.querySelector('.icon-input-row input');
    return [getComputedStyle(field).outlineColor, getComputedStyle(document.querySelector('.invalid-summary')).color];
  });
  expect(errorColors[0]).toBe(errorColors[1]);
  await icon.fill('fluent:calendar-20-regular');
  await name.fill('Repaired');
  await expect(iconSummary.locator('.invalid-summary')).toHaveCount(0);
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  const day = page.getByLabel('Day', { exact: true });
  await day.fill('');
  await expect(day).toHaveAttribute('aria-invalid', 'true');
  await expect(day).toHaveCSS('outline-width', '2px');
  const expressionSummary = page.locator('.settings-section > summary').filter({ hasText: /^Date expression/ });
  await expect(expressionSummary.locator('.invalid-summary')).toHaveText('Check date');
  await day.fill('25');
  await expect(expressionSummary.locator('.invalid-summary')).toHaveCount(0);
  await iconButton.click();
  await expect(icon).toBeFocused();
  await expect(iconButton).toHaveAttribute('aria-expanded', 'true');
});

test('template icon fields stay readable and payday options align below the input fields', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  async function chooseTemplate(title) {
    const back = page.locator('.template-back');
    if (await back.isVisible()) await back.click();
    await page.getByRole('searchbox', { name: 'Search templates', exact: true }).fill(title);
    await page.locator('.template-list').getByRole('button', { name: new RegExp(title) }).click();
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await chooseTemplate('One-time event');
    const icon = page.locator('.template-detail').getByLabel('Icon', { exact: true });
    const iconBox = await icon.boundingBox();
    expect(iconBox.width).toBeGreaterThanOrEqual(200);
    await icon.fill('fluent:calendar-20-regular');
    await expect(icon).toHaveValue('fluent:calendar-20-regular');
    const browse = await page.locator('.template-detail').getByRole('button', { name: 'Browse…', exact: true }).boundingBox();
    expect(browse.x).toBeGreaterThanOrEqual(iconBox.x);
    expect(await page.locator('.template-detail').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const title of ['Payday on a fixed day each month', 'Payday on several days each month']) {
      await chooseTemplate(title);
      const checkbox = page.getByRole('checkbox', { name: 'Move to nearest weekday', exact: true });
      const bounds = await checkbox.evaluate(input => {
        const label = input.closest('label');
        const checkbox = input.getBoundingClientRect();
        const text = label.querySelector('span').getBoundingClientRect();
        const inputs = [...input.closest('.template-params').querySelectorAll('input:not([type="checkbox"])')].map(field => field.getBoundingClientRect());
        return { left: checkbox.x, fieldLeft: inputs[0].x, top: label.getBoundingClientRect().top, fieldBottom: Math.max(...inputs.map(box => box.bottom)), centerDifference: Math.abs(checkbox.y + checkbox.height / 2 - text.y - text.height / 2), height: label.getBoundingClientRect().height };
      });
      expect(Math.abs(bounds.left - bounds.fieldLeft)).toBeLessThanOrEqual(1);
      expect(bounds.top).toBeGreaterThan(bounds.fieldBottom);
      expect(bounds.centerDifference).toBeLessThanOrEqual(1);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
    }
  }
});

for (const mode of ['start', 'add']) {
  test(`${mode} template desktop columns scroll independently`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await seed(page, { draft: mode === 'start' ? null : holidays });
    await page.goto('/holiday-editor/#manual');
    await page.getByRole('button', { name: mode === 'start' ? /Start from a template/ : 'Templates', exact: mode === 'add' }).click();
    await page.locator('.template-list').getByRole('button', { name: /United States federal holidays/ }).click();
    const browser = page.getByRole('region', { name: 'Template browser', exact: true });
    const detail = page.getByRole('region', { name: 'Template details', exact: true });
    for (const region of [browser, detail]) {
      await expect(region).toHaveCSS('overflow-y', 'auto');
      expect(await region.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    }
    await browser.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => browser.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await detail.evaluate(element => element.scrollTop)).toBe(0);
    const leftScroll = await browser.evaluate(element => element.scrollTop);
    await detail.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => detail.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await browser.evaluate(element => element.scrollTop)).toBe(leftScroll);
    expect(await page.locator('dialog[open] .modal-content').evaluate(element => element.scrollTop)).toBe(0);
    await expect(page.locator('.template-apply')).toBeInViewport();
  });
}

test('all recurrence types, alternate calendars, and rounding remain editable', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await selectHoliday(page, 'Christmas');
  await page.getByRole('radio', { name: /One-time date/ }).check();
  await page.getByLabel('Year', { exact: true }).fill('2038');
  await page.getByLabel('Month', { exact: true }).selectOption('1');
  await page.getByLabel('Day', { exact: true }).fill('19');
  await page.getByText('Date expression & repetition', { exact: true }).click();
  await expect(page.locator('.date-expression')).toHaveText('2038-01-19');
  await page.getByRole('radio', { name: /Every year/ }).check();
  await expect(page.locator('.date-expression')).toHaveText('01-19');
  await page.getByRole('radio', { name: 'Weekday in a month For example, the second Friday', exact: true }).check();
  await page.getByLabel('Occurrence', { exact: true }).selectOption('2');
  await page.getByLabel('Weekday', { exact: true }).selectOption('5');
  await expect(page.locator('.date-expression')).toHaveText('01W2-5');
  await page.getByRole('radio', { name: /Weekday from the end/ }).check();
  await expect(page.locator('.date-expression')).toHaveText('01Wn2-5');
  await page.getByRole('radio', { name: /Every year/ }).check();
  await page.locator('.settings-section > summary').filter({ hasText: /^Calendar/ }).click();
  await page.getByLabel('Use a different calendar').check();
  await page.getByLabel('Calendar system').selectOption('chinese');
  await expect(page.locator('.date-expression')).toContainText('[u-ca=chinese]');
  await page.locator('.settings-section > summary').filter({ hasText: /^Weekday adjustment/ }).click();
  await page.getByRole('button', { name: 'Weekends', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Sat', exact: true })).toBeChecked();
  const checkedChip = page.locator('.round-chips label').filter({ hasText: 'Sat' }).locator('span');
  expect(await checkedChip.evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  await expect(page.getByRole('checkbox', { name: 'Mon', exact: true })).not.toBeChecked();
});

test('search retains canonical order and deletion Undo restores position and fields', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await page.getByRole('searchbox', { name: 'Search holidays' }).fill('Memorial');
  await selectHoliday(page, 'Memorial Day');
  await page.getByRole('button', { name: 'Move up', exact: true }).click();
  await page.getByRole('button', { name: 'Delete holiday', exact: true }).click();
  await page.getByRole('button', { name: 'Undo deletion' }).click();
  await expect(page.getByLabel('Holiday name', { exact: true })).toHaveValue('Memorial Day');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('trmnl-holiday-editor')));
  expect(saved[0].name).toBe('Memorial Day');
  expect(saved[0].date).toBe('05Wn1-1');
  await more(page, 'View YAML');
  await expect(page.getByLabel('Generated holiday YAML')).toHaveValue(/Memorial Day[\s\S]*Christmas[\s\S]*Launch/);
});

test('modal focus is contained and restored, imports reject errors and confirm replacement', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await more(page, 'Import YAML');
  const dialog = page.getByRole('dialog', { name: 'Load YAML' });
  await expect(page.getByLabel('Holiday YAML', { exact: true })).toBeFocused();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement))).toBe(true);
  }
  await page.getByLabel('Holiday YAML', { exact: true }).fill('- [');
  await dialog.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('YAML parse error');
  await page.getByLabel('Holiday YAML', { exact: true }).fill('- name: New year\n  date: 01-01\n  icon: fluent:calendar-20-regular\n');
  await dialog.getByRole('button', { name: 'Load', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Replace current holidays?' });
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: 'Replace holidays', exact: true }).click();
  await expect(page.getByLabel('Holiday name', { exact: true })).toHaveValue('New year');
  await more(page, 'View YAML');
  await expect(page.getByRole('dialog', { name: 'Your holidays as YAML' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.action-menu > summary')).toBeFocused();
});

test('templates keep parameters, duplicate defaults, entry selection, and month repetition', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search templates' }).fill('Birthday');
  await page.locator('.template-list').getByRole('button', { name: /Birthday/ }).click();
  await expect(page.locator('.template-detail')).toBeVisible();
  const nameField = page.locator('.template-param input[type=text]').first();
  await nameField.fill('Fixture birthday');
  await page.locator('.template-apply').click();
  await expect(page.getByLabel('Holiday name', { exact: true })).toHaveValue(/Fixture birthday/);
  await page.getByText('Date expression & repetition', { exact: true }).click();
  await page.getByRole('button', { name: 'Repeat for all months', exact: true }).click();
  await page.getByRole('button', { name: 'Create 12 entries', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trmnl-holiday-editor')).length)).toBe(15);
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search templates' }).fill('Common celebrations');
  await page.locator('.template-list').getByRole('button', { name: /Common celebrations/ }).click();
  await expect(page.locator('.template-entries')).toBeVisible();
  await expect(page.locator('.template-entries li.duplicate input')).not.toBeChecked();
  await page.locator('.template-entries-header').getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.template-entries li.duplicate input')).toBeChecked();
  await page.locator('.template-entries-header').getByRole('button', { name: 'None', exact: true }).click();
  await expect(page.locator('.template-apply')).toBeDisabled();
});

test('copy success and clipboard failure have clear recoverable feedback', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedYaml = text; } } }));
  await page.goto('/holiday-editor/#manual');
  await page.getByRole('button', { name: 'Copy YAML', exact: true }).click();
  await expect(page.getByText(/^YAML copied\./)).toBeVisible();
  expect(await page.evaluate(() => window.copiedYaml)).toContain('Christmas');
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
  await page.getByRole('button', { name: 'Copied', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your holidays as YAML' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('copy it manually');
  await expect(page.getByLabel('Generated holiday YAML')).toHaveValue(/Christmas/);
});

test('unrecognized dates stay unchanged until date controls are edited', async ({ page }) => {
  await seed(page, { draft: [{ name: 'Unknown', icon: 'fluent:calendar-20-regular', date: 'next tuesday' }] });
  await page.goto('/holiday-editor/#manual');
  await selectHoliday(page, 'Unknown');
  await expect(page.locator('.date-composer')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.settings-section > summary .invalid-summary')).toHaveText('Check date');
  await page.getByLabel('Holiday name', { exact: true }).fill('Renamed');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trmnl-holiday-editor'))[0].date)).toBe('next tuesday');
  await expect(page.getByText('Unrecognized date', { exact: false }).last()).toBeVisible();
  await page.getByLabel('Day', { exact: true }).fill('5');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trmnl-holiday-editor'))[0].date)).toBe('01-05');
});

test('reference YAML highlighting preserves example text and stays accessible in both themes', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#reference');
  const expected = [
    'name: Christmas Day',
    'date: "01-01[u-ca=chinese]"   # Chinese New Year (1st of 1st month in Chinese calendar)',
    'icon: fluent-emoji-flat:fireworks',
    'round: [1, 2, 3, 4, 5]   # Round to nearest weekday (Mon–Fri)',
    `- name: Christmas Day
  date: "12-25"
  icon: fluent-emoji-flat:fireworks
  round: [1, 2, 3, 4, 5]
- name: Year 2038 problem
  date: "2038-01-19"
  icon: mdi:cpu-32-bit
- name: US Memorial Day
  date: "05Wn1-1"
  icon: fluent-emoji-flat:reindeer-ribbon
- name: Chinese New Year
  date: "01-01[u-ca=chinese]"
  icon: fluent-emoji-flat:red-envelope`,
  ];
  const examples = page.locator('.docs pre');
  await expect(examples).toHaveCount(expected.length);
  expect(await examples.allTextContents()).toEqual(expected);
  await expect(page.locator('.yaml-example > code.language-yaml')).toHaveCount(expected.length);
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Appearance').selectOption(theme);
    const colors = await page.locator('.docs').evaluate(element =>
      ['yaml-key', 'yaml-string', 'yaml-number', 'yaml-comment'].map(token => getComputedStyle(element.querySelector(`.${token}`)).color));
    expect(new Set(colors).size).toBe(4);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(width => document.documentElement.scrollWidth <= width, width)).toBe(true);
      expect(await examples.allTextContents()).toEqual(expected);
    }
  }
});

test('themes, mobile widths, reference, and static callback remain accessible', async ({ page }) => {
  await seed(page);
  await page.goto('/trmnl-recipes/holiday-editor/index.html#manual');
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Appearance').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(width => document.documentElement.scrollWidth <= width, width)).toBe(true);
  }
  await page.getByRole('link', { name: 'Guide', exact: true }).click();
  await page.getByRole('link', { name: 'Date rules', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'date (string, required)' })).toBeVisible();
  await page.goto('/trmnl-recipes/holiday-editor/callback.html?error=access_denied');
  await expect(page.locator('#status')).toContainText('Sign-in failed');
  await expect(page.getByRole('link', { name: 'Back to the editor' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
});

test('connected discovery, explicit save, rename, ordinal, and copying preserve API contracts', async ({ page }) => {
  await seed(page, { session: true });
  const api = await mockTrmnl(page);
  await page.goto('/holiday-editor/#trmnl');
  await page.getByRole('link', { name: /Desk calendar/ }).click();
  await page.getByLabel('Plugin name', { exact: true }).fill('New desk name');
  await page.getByLabel('Upcoming holiday to display', { exact: true }).fill('2');
  await selectHoliday(page, 'Christmas');
  await page.getByLabel('Holiday name', { exact: true }).fill('Christmas updated');
  expect(api.requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Save to TRMNL', exact: true }).click();
  await expect(page.locator('.save-state')).toContainText('Saved at');
  expect(api.requests[0].body.fields.holiday_number).toBe('2');
  expect(api.requests[0].body.fields.holidays).toContain('Christmas updated');
  expect(api.plugins['1'].name).toBe('New desk name');
  await more(page, 'Copy to other plugins…');
  const copy = page.getByRole('dialog', { name: 'Copy holidays to other plugins' });
  await copy.getByRole('checkbox', { name: /I understand/ }).check();
  await copy.getByRole('button', { name: 'Overwrite 2 plugins' }).click();
  await expect(copy.getByText('2 updated.')).toBeVisible();
  expect(api.plugins['2'].number).toBe('2');
  expect(api.plugins['3'].number).toBe('3');
  expect(api.plugins['2'].yaml).toContain('Christmas updated');
});

test('unsaved guards, restore, comments, conflicts, warnings, and copy retries stay recoverable', async ({ page }) => {
  await seed(page, { session: true });
  const api = await mockTrmnl(page, { yaml: '# original comment\n- name: Christmas\n  date: 12-25\n  icon: fluent:calendar-20-regular\n', warnings: ['Check the display'], failTargets: ['3'] });
  await page.goto('/holiday-editor/#trmnl/1');
  await selectHoliday(page, 'Christmas');
  await page.getByLabel('Holiday name', { exact: true }).fill('Unsaved edit');
  await page.getByRole('link', { name: 'Local editor', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Holiday name', { exact: true })).toHaveValue('Unsaved edit');
  api.plugins['1'].number = '2';
  await page.getByRole('button', { name: 'Save to TRMNL', exact: true }).click();
  await page.getByRole('button', { name: 'Save anyway', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'This plugin changed on TRMNL' })).toBeVisible();
  await page.getByRole('button', { name: 'Overwrite', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /with warnings/ }).last()).toBeVisible();
  await more(page, 'Copy to other plugins…');
  const copy = page.getByRole('dialog', { name: 'Copy holidays to other plugins' });
  await copy.getByRole('checkbox', { name: /I understand/ }).check();
  await copy.getByRole('button', { name: 'Overwrite 2 plugins' }).click();
  await expect(copy.getByText('1 updated, 1 failed.')).toBeVisible();
  api.failures.clear();
  await copy.getByRole('button', { name: 'Retry failed' }).click();
  await expect(copy.getByText('2 updated.')).toBeVisible();
});

test('session stashes restore and invalid server responses are explicit', async ({ page }) => {
  await seed(page, { session: true, stash: { list: [{ name: 'Restored', date: '01-01', icon: 'fluent:calendar-20-regular' }], listDirty: true, number: '1', name: 'Desk calendar' } });
  await mockTrmnl(page, { invalid: true });
  await page.goto('/holiday-editor/#trmnl/1');
  await page.getByRole('button', { name: 'Restore them' }).click();
  await selectHoliday(page, 'Restored');
  await page.getByRole('button', { name: 'Save to TRMNL', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('TRMNL rejected');
  await expect(page.getByText('holidays: Invalid holiday', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Holiday name', { exact: true })).toHaveValue('Restored');
});

test('empty drafts and blocked local storage do not claim false persistence', async ({ page }) => {
  await seed(page, { draft: [] });
  await page.goto('/holiday-editor/#manual');
  await expect(page.getByText('Your next important date starts here')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Your next important date starts here')).toBeVisible();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'trmnl-holiday-editor') throw new Error('Storage denied');
      return write.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Add holiday', exact: true }).first().click();
  await page.getByLabel('Holiday name', { exact: true }).fill('Not persisted');
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(page.getByText('Saved in this browser', { exact: true })).not.toBeVisible();
});

test('icon search errors, retries, and nested dialog focus remain recoverable', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await selectHoliday(page, 'Christmas');
  await page.getByText('Holiday icon', { exact: false }).click();
  await page.getByRole('button', { name: 'Browse icons', exact: true }).click();
  await page.route('https://api.iconify.design/search?**', route => route.abort());
  await page.getByRole('searchbox', { name: 'Search icons', exact: true }).fill('calendar');
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await page.unroute('https://api.iconify.design/search?**');
  await page.getByRole('button', { name: 'Retry search', exact: true }).click();
  await page.getByRole('button', { name: 'fluent:calendar-20-regular', exact: true }).click();
  await expect(page.getByLabel('Icon identifier')).toHaveValue('fluent:calendar-20-regular');
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search templates' }).fill('One-time event');
  await page.locator('.template-list').getByRole('button', { name: /One-time event/ }).click();
  await page.locator('.template-detail').getByRole('button', { name: 'Browse…' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search icons', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Add from a template' })).toBeVisible();
  await expect(page.locator('.template-detail').getByRole('button', { name: 'Browse…' })).toBeFocused();
});

test('invalid API keys remain on the sign-in screen with an error', async ({ page }) => {
  await seed(page, { draft: null });
  const api = await mockTrmnl(page);
  api.state.unauthorized = true;
  await page.goto('/holiday-editor/#trmnl');
  await page.getByLabel('Account API key').fill('rejected-fixture-key');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('That API key was rejected by TRMNL.');
  expect(await page.evaluate(() => localStorage.getItem('trmnl-holiday-editor:session'))).toBe(null);
  api.state.unauthorized = false;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your holiday plugins' })).toBeVisible();
});

test('expiry preserves unsaved stashes, and missing write scope disables remote actions', async ({ page }) => {
  await seed(page, { session: true });
  const api = await mockTrmnl(page);
  await page.goto('/holiday-editor/#trmnl/1');
  await selectHoliday(page, 'Christmas');
  await page.getByLabel('Holiday name', { exact: true }).fill('Recover after expiry');
  api.state.unauthorized = true;
  await page.getByRole('button', { name: 'Save to TRMNL', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connect your TRMNL account' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('trmnl-holiday-editor:stash:1')).list[0].name)).toBe('Recover after expiry');
  api.state.unauthorized = false;
  await page.evaluate(() => localStorage.setItem('trmnl-holiday-editor:session', JSON.stringify({ type: 'oauth', accessToken: 'fixture-token', scope: 'read', expiresAt: Date.now() + 100000 })));
  await page.reload();
  await page.getByRole('button', { name: 'Restore them' }).click();
  await expect(page.getByText(/not granted the "content" permission/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save to TRMNL', exact: true })).toBeDisabled();
});

test('invalid connected YAML can be repaired without losing the original text', async ({ page }) => {
  await seed(page, { session: true });
  await mockTrmnl(page, { yaml: '- [' });
  await page.goto('/holiday-editor/#trmnl/1');
  await page.getByRole('button', { name: 'Fix the YAML', exact: true }).click();
  await expect(page.getByLabel('Holiday YAML', { exact: true })).toHaveValue('- [');
});

test('detail controls and template dialogs meet contrast and label requirements in both themes', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Appearance').selectOption(theme);
    await selectHoliday(page, 'Christmas');
    await page.locator('.settings-section > summary').filter({ hasText: /^Weekday adjustment/ }).click();
    const detail = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(detail.violations).toEqual([]);
    const boundaryContrast = await page.getByLabel('Holiday name', { exact: true }).evaluate(input => {
      const luminance = color => {
        const channels = color.match(/\d+/g).slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const style = getComputedStyle(input);
      const border = luminance(style.borderTopColor);
      return [style.backgroundColor, getComputedStyle(input.closest('.holiday-detail')).backgroundColor]
        .map(color => (Math.max(border, luminance(color)) + .05) / (Math.min(border, luminance(color)) + .05));
    });
    for (const contrast of boundaryContrast) expect(contrast).toBeGreaterThanOrEqual(3);
    const weekday = page.getByRole('checkbox', { name: 'Sat', exact: true });
    const box = await weekday.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await weekday.focus();
    await page.keyboard.press('Space');
    await expect(weekday).toBeChecked();
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search templates' }).fill('One-time event');
    await page.locator('.template-list').getByRole('button', { name: /One-time event/ }).click();
    const templates = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(templates.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await weekday.focus();
    await page.keyboard.press('Space');
    await page.locator('.settings-section > summary').filter({ hasText: /^Weekday adjustment/ }).click();
  }
});

test('200 percent text size keeps primary workflows within narrow viewports', async ({ page }) => {
  await seed(page);
  await page.goto('/holiday-editor/#manual');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(width => document.documentElement.scrollWidth <= width, width)).toBe(true);
    await selectHoliday(page, 'Christmas');
    expect(await page.evaluate(width => document.documentElement.scrollWidth <= width, width)).toBe(true);
  }
});
