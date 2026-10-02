export const holidays = [
  { name: 'Christmas', date: '12-25', icon: 'fluent:calendar-20-regular', round: [1, 2, 3, 4, 5] },
  { name: 'Memorial Day', date: '05Wn1-1', icon: 'fluent:calendar-20-regular' },
  { name: 'Launch', date: '2038-01-19', icon: 'fluent:calendar-20-regular' },
];

export async function seed(page, { draft = holidays, session = false, theme = 'dark', stash = null } = {}) {
  await page.addInitScript(({ draft, session, theme, stash }) => {
    if (sessionStorage.getItem('test-seeded')) return;
    sessionStorage.setItem('test-seeded', 'true');
    localStorage.setItem('trmnl-holiday-editor:theme', theme);
    if (draft !== null) localStorage.setItem('trmnl-holiday-editor', JSON.stringify(draft));
    if (session) localStorage.setItem('trmnl-holiday-editor:session', JSON.stringify({ type: 'apikey', accessToken: 'fixture-token' }));
    if (stash) sessionStorage.setItem('trmnl-holiday-editor:stash:1', JSON.stringify(stash));
  }, { draft, session, theme, stash });
}

export async function selectHoliday(page, name) {
  const back = page.getByRole('button', { name: 'Back to holidays' });
  if (await back.isVisible()) await back.click();
  await page.locator('.holiday-row').filter({ hasText: name }).click();
}

export async function more(page, name) {
  await page.locator('.action-menu > summary').click();
  await page.locator('.action-menu-content').getByRole('button', { name, exact: true }).click();
}

export async function mockTrmnl(page, options = {}) {
  const plugins = {
    '1': { name: 'Desk calendar', yaml: options.yaml || '- name: Christmas\n  date: 12-25\n  icon: fluent:calendar-20-regular\n', number: '1' },
    '2': { name: 'Kitchen calendar', yaml: '[]\n', number: '2' },
    '3': { name: 'Bedroom calendar', yaml: '[]\n', number: '3' },
  };
  const requests = [];
  const failures = new Set(options.failTargets || []);
  const state = { unauthorized: false };
  await page.route('https://trmnl.com/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const parts = url.pathname.split('/');
    const id = parts[3];
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return; }
    const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } });
    if (state.unauthorized) return respond({ error: 'Session expired' }, 401);
    if (url.pathname === '/api/me') return respond({ data: { name: 'Test account' } });
    if (url.pathname === '/api/plugin_settings') return respond({ data: Object.entries(plugins).map(([id, plugin]) => ({ id, name: plugin.name, plugin_id: 123, 'read_only?': id === '1' })) });
    const plugin = plugins[id];
    if (!plugin) return respond({ error: 'Plugin not found' }, 404);
    if (parts[4] === 'details') return respond({ data: { name: plugin.name, custom_fields: [{ keyname: 'holidays' }, { keyname: 'holiday_number' }], settings: { custom_fields_values: { holidays: plugin.yaml, holiday_number: plugin.number } } } });
    if (method === 'PATCH') {
      const body = request.postDataJSON();
      requests.push({ id, body });
      if (failures.has(id)) return respond({ error: 'No access to this plugin' }, 403);
      if (options.invalid) return respond({ error: { message: 'Bad setting', field_errors: [{ path: '/values/holidays', message: 'Invalid holiday' }] } }, 422);
      if (body.fields) {
        if (body.fields.holidays !== undefined) plugin.yaml = body.fields.holidays;
        if (body.fields.holiday_number !== undefined) plugin.number = body.fields.holiday_number;
      }
      if (body.name) plugin.name = body.name;
      return respond({ data: { warnings: options.warnings || [] } });
    }
    return respond({});
  });
  return { plugins, requests, failures, state };
}
