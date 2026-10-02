import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATES, TEMPLATE_CATEGORIES, defaultParams, paramErrors, buildTemplateEntries, searchTemplates,
} from '../../.github.pages/holiday-editor/js/templates.js';
import { makeHoliday, holidayErrors, parseDateStr } from '../../.github.pages/holiday-editor/js/holiday-model.js';
import { upcomingOccurrences } from '../../.github.pages/holiday-editor/js/date-core.js';

const today = Temporal.PlainDate.from('2026-01-01');

// Fill required parameters that have no usable default.
function sampleParams(t) {
  const p = defaultParams(t);
  for (const def of t.params || []) {
    if (def.type === 'date' && !p[def.key]) p[def.key] = def.key === 'end' ? '2026-12-18' : '2026-09-01';
  }
  return p;
}

test('template metadata is well-formed', () => {
  const ids = new Set();
  const categories = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
  for (const t of TEMPLATES) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.ok(categories.has(t.category), `${t.id}: unknown category`);
    assert.ok(t.title && t.description && t.icon, `${t.id}: missing metadata`);
  }
  for (const c of TEMPLATE_CATEGORIES) assert.ok(TEMPLATES.some((t) => t.category === c.id), `empty category ${c.id}`);
});

test('every template entry is valid and has an upcoming date', () => {
  for (const t of TEMPLATES) {
    const params = sampleParams(t);
    assert.deepEqual(paramErrors(t, params), {}, `${t.id}: sample params invalid`);
    const entries = buildTemplateEntries(t, params, { today });
    assert.ok(entries.length > 0, `${t.id}: no entries`);
    for (const e of entries) {
      const label = `${t.id} / ${e.name} (${e.date})`;
      assert.equal(parseDateStr(e.date).invalid, false, `${label}: invalid date`);
      assert.deepEqual(holidayErrors(makeHoliday(e)), [], label);
      if (t.id === 'weekend' && /W5-/.test(e.date)) continue; // 5th weekday doesn't exist every month
      assert.ok(upcomingOccurrences(e.date, e.round, today, 1).length > 0, `${label}: never occurs`);
    }
  }
});

test('known dates resolve correctly', () => {
  const next = (id, name) => {
    const e = buildTemplateEntries(TEMPLATES.find((t) => t.id === id)).find((x) => x.name === name);
    return upcomingOccurrences(e.date, e.round, today, 1)[0].iso;
  };
  assert.equal(next('us-federal', 'Thanksgiving'), '2026-11-26');
  assert.equal(next('us-federal', 'Independence Day'), '2026-07-03'); // observed on Friday
  assert.equal(next('chinese-traditional', 'Chinese New Year'), '2026-02-17');
  assert.equal(next('jewish', 'Rosh Hashanah'), '2026-09-12');
  assert.equal(next('jewish', 'Passover'), '2026-04-02');
  assert.equal(next('dst-us', buildTemplateEntries(TEMPLATES.find((t) => t.id === 'dst-us'))[0].name), '2026-03-08');
});

test('parameterized templates use their parameters', () => {
  const payday = TEMPLATES.find((t) => t.id === 'payday-day-of-month');
  const entries = buildTemplateEntries(payday, { title: 'Salary', day: 25, weekdaysOnly: false });
  assert.equal(entries.length, 12);
  assert.deepEqual(entries[1], { name: 'Salary', date: '02-25', icon: 'fluent-emoji-flat:money-bag' });
  assert.ok(paramErrors(payday, { title: '', day: 31, weekdaysOnly: true }).day);

  const multi = TEMPLATES.find((t) => t.id === 'payday-multiple-days');
  const semi = buildTemplateEntries(multi, { title: 'Pay', days: '15, last', weekdaysOnly: false });
  assert.equal(semi.length, 24);
  assert.deepEqual(semi.slice(2, 6).map((e) => e.date), ['02-15', '02-28', '03-15', '03-31']);
  assert.deepEqual(buildTemplateEntries(multi, { title: 'Pay', days: '30 31 1', weekdaysOnly: true })
    .filter((e) => e.date.startsWith('04-')).map((e) => e.date), ['04-01', '04-30']);
  assert.deepEqual(semi[0], { name: 'Pay', date: '01-15', icon: 'fluent-emoji-flat:money-with-wings' });
  assert.ok(paramErrors(multi, { title: '', days: '0, 15', weekdaysOnly: true }).days);
  assert.ok(paramErrors(multi, { title: '', days: '', weekdaysOnly: true }).days);

  const meeting = TEMPLATES.find((t) => t.id === 'monthly-meeting');
  assert.equal(buildTemplateEntries(meeting, { title: 'Club', occurrence: -1, weekday: 3 })[0].date, '01Wn1-3');

  const birthday = TEMPLATES.find((t) => t.id === 'birthday');
  assert.deepEqual(buildTemplateEntries(birthday, { who: 'Sam', date: '03-04' }),
    [{ name: "Sam's birthday", date: '03-04', icon: 'fluent-emoji-flat:birthday-cake' }]);
  assert.ok(paramErrors(TEMPLATES.find((t) => t.id === 'one-off-event'), defaultParams(TEMPLATES.find((t) => t.id === 'one-off-event'))).date);
});

test('search matches title, tags and category', () => {
  assert.ok(searchTemplates('lunar new year', '').length + searchTemplates('chinese', '').length > 0);
  assert.ok(searchTemplates('salary', '').every((t) => t.category === 'money'));
  assert.equal(searchTemplates('', 'personal').length, TEMPLATES.filter((t) => t.category === 'personal').length);
  assert.deepEqual(searchTemplates('zzzz-nothing', ''), []);
});
