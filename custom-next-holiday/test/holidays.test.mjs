import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/shared.liquid', import.meta.url), 'utf8');
const dateFunctions = source.slice(
  source.indexOf('  function nthWeekdayOfMonth('),
  source.indexOf('  const { todayHolidays, nextHolidays, nextDays }'),
);
const findHolidays = new Function('Temporal', `${dateFunctions}\nreturn findHolidays;`)(Temporal);
const formatterSource = source.slice(
  source.indexOf('  function holidayNames('),
  source.indexOf('  applyHTML('),
);
const holidayNames = new Function(`${formatterSource}\nreturn holidayNames;`)();
const today = Temporal.PlainDate.from('2026-09-20');
const holiday = (name, date, extra = {}) => ({ name, date, icon: `test:${name}`, ...extra });

function render(holidays, holidayNumber = 1) {
  const text = { dataset: {} };
  const icon = { setAttribute(key, value) { this[key] = value; } };
  const root = { querySelector: selector => selector === 'iconify-icon' ? icon : text };
  const setup = source.slice(
    source.indexOf('  const { todayHolidays, nextHolidays, nextDays }'),
    source.indexOf('\n})();'),
  ).replaceAll('{% raw %}', '').replaceAll('{% endraw %}', '');
  new Function('findHolidays', 'holidays', 'today', 'holidayNumber', 'root', 'noHolidayIcon', setup)(
    findHolidays, holidays, today, holidayNumber, root, 'empty',
  );
  return { text, icon };
}

test('groups today and upcoming dates, sorted by date rather than input order', () => {
  const holidays = [
    holiday('Later', '2026-09-25'),
    holiday('Today A', '2026-09-20'),
    holiday('Next A', '2026-09-21'),
    holiday('Today B', '2026-09-20'),
    holiday('Next B', '2026-09-21'),
    holiday('Past', '2026-09-19'),
  ];
  const first = findHolidays(holidays, today, 1);
  assert.deepEqual(first.todayHolidays.map(h => h.name), ['Today A', 'Today B']);
  assert.deepEqual(first.nextHolidays.map(h => h.name), ['Next A', 'Next B']);
  assert.equal(first.nextDays, 1);
  assert.equal(findHolidays(holidays, today, 2).nextHolidays[0].name, 'Later');
  assert.deepEqual(findHolidays(holidays, today, 3).nextHolidays, []);
});

test('groups after weekday rounding and date resolution, including next-year recurrence', () => {
  const holidays = [
    holiday('Rounded', '2026-09-20', { round: [1] }),
    holiday('Monthly weekday', '09W3-1'),
    holiday('Annual', '09-21'),
  ];
  const result = findHolidays(holidays, today, 1);
  assert.deepEqual(result.nextHolidays.map(h => h.name), ['Rounded', 'Monthly weekday', 'Annual']);
  assert.equal(result.nextDays, 1);
  const newYear = findHolidays([
    holiday('A', '01-01'), holiday('B', '2027-01-01'),
  ], today, 1);
  assert.deepEqual(newYear.nextHolidays.map(h => h.name), ['A', 'B']);
});

test('multiple holidays today hide the next row and use a matching icon', () => {
  const { text, icon } = render([
    holiday('Today A', '2026-09-20'),
    holiday('Today B', '2026-09-20'),
    holiday('Next', '2026-09-21'),
  ]);
  assert.equal(text.dataset.t, 'today_only');
  assert.deepEqual(JSON.parse(text.dataset.tName), ['Today A', 'Today B']);
  assert.equal(text.dataset.tNextName, undefined);
  assert.equal(icon.icon, 'test:Today A');
});

test('one holiday today retains the next row, including every colliding next name', () => {
  const { text, icon } = render([
    holiday('Today', '2026-09-20'),
    holiday('Next A', '2026-09-21'),
    holiday('Next B', '2026-09-21'),
  ]);
  assert.equal(text.dataset.t, 'today_and_next');
  assert.deepEqual(JSON.parse(text.dataset.tNextName), ['Next A', 'Next B']);
  assert.equal(text.dataset.tNextDays, 1);
  assert.equal(icon.icon, 'test:Today');
});

test('next-only, today-only and no-holiday states retain their behavior', () => {
  const next = render([holiday('A', '2026-09-21'), holiday('B', '2026-09-21')]);
  assert.equal(next.text.dataset.t, 'next_only');
  assert.deepEqual(JSON.parse(next.text.dataset.tNextName), ['A', 'B']);
  assert.equal(next.icon.icon, 'test:A');
  assert.equal(render([holiday('Today', '2026-09-20')]).text.dataset.t, 'today_only');
  assert.equal(render([]).text.dataset.t, 'no_holidays');
  assert.equal(render([holiday('Past', '2026-09-19')]).icon.icon, 'empty');
  assert.equal(render([holiday('Next', '2026-09-21')], 2).text.dataset.t, 'no_holidays');
});

const translations = JSON.parse(source.match(/{% raw %}\s*([\s\S]*?)\s*{% endraw %}/)[1]);
for (const locale of Object.keys(translations)) {
  test(`${locale}: list text and markup match Intl.ListFormat for two and three holidays`, () => {
    for (const names of [['Alpha', 'Beta'], ['<b>Alpha</b>', 'Beta & Co', 'Gamma']]) {
      const expected = new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' });
      const formatted = holidayNames({ locales: [new Intl.Locale(locale)] }, {}, names);
      assert.equal(formatted.toString(), expected.format(names));
      const parts = formatted.toParts();
      expected.formatToParts(names).forEach(({ type, value }, index) => {
        const name = type === 'element' ? 'mainValue' : 'mainLabel';
        assert.deepEqual(parts.slice(index * 3, index * 3 + 3), [
          { type: 'markup', kind: 'open', name },
          { type: 'text', value },
          { type: 'markup', kind: 'close', name },
        ]);
      });
    }
    for (const key of ['today_only', 'today_and_next', 'next_only']) {
      assert.doesNotMatch(translations[locale][key], /\{\$(?:name|nextName)\}/);
    }
  });
}

test('secondary names and separators always use subLabel', () => {
  const context = { locales: ['en'] };
  const options = { secondary: 'true' };
  assert.equal(holidayNames(context, options, ['Only']).toParts()[0].name, 'subLabel');
  assert.equal(holidayNames(context, {}, ['Only']).toParts()[0].name, 'mainValue');
  const parts = holidayNames(context, options, ['One', 'Two']).toParts();
  assert.deepEqual(parts.filter(p => p.kind === 'open').map(p => p.name),
    ['subLabel', 'subLabel', 'subLabel']);
  assert.throws(() => holidayNames(context, {}, 'Not an array'), TypeError);
});
