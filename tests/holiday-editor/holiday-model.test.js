import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateStr, makeHoliday, reviveHoliday, composeDateStr, holidayErrors, toPlain, toPlainList, dumpYaml,
  serializeList, dedupeKey, yamlHasComments, parseHolidaysYaml, buildMonthDuplicates, canDuplicateAcrossMonths, normalizeMonth,
} from '../../.github.pages/holiday-editor/js/holiday-model.js';

const today = Temporal.PlainDate.from('2026-01-01');

test('date strings round-trip through the composer', () => {
  for (const s of ['2038-01-19', '12-25', '08W2-5', '05Wn1-1', '01-01[u-ca=chinese]', '2026-07-15[u-ca=hebrew]', '03W2-7']) {
    assert.equal(composeDateStr(makeHoliday({ name: 'x', icon: 'y', date: s })), s, s);
  }
});

test('unrecognized dates are kept verbatim and flagged', () => {
  assert.equal(parseDateStr('next tuesday').invalid, true);
  const h = makeHoliday({ name: 'x', icon: 'y', date: 'next tuesday' });
  assert.equal(h._dateInvalid, true);
  assert.equal(composeDateStr(h), 'next tuesday');
  assert.deepEqual(holidayErrors(h), ['Unrecognized date "next tuesday"']);
  assert.equal(toPlain(h).date, 'next tuesday');
});

test('YAML Date scalars become YYYY-MM-DD', () => {
  const { items } = parseHolidaysYaml('- name: Y2038\n  date: 2038-01-19\n  icon: mdi:cpu-32-bit\n');
  const h = makeHoliday(items[0]);
  assert.equal(h.date, '2038-01-19');
  assert.equal(h._dateType, 'absolute');
});

test('validation reports missing fields', () => {
  assert.deepEqual(holidayErrors(makeHoliday()), ['Name is required', 'Icon is required']);
  assert.deepEqual(holidayErrors(makeHoliday({ name: 'a', icon: 'b', date: '01-01' })), []);
});

test('plain conversion sorts and de-duplicates round', () => {
  const plain = toPlain(makeHoliday({ name: 'a', icon: 'b', date: '01-01', round: [5, 1, 5, 9] }));
  assert.deepEqual(plain, { name: 'a', date: '01-01', icon: 'b', round: [1, 5] });
  assert.equal('round' in toPlain(makeHoliday({ name: 'a', icon: 'b', date: '01-01' })), false);
});

test('YAML dump and parse round-trip', () => {
  const list = [
    makeHoliday({ name: 'Christmas', date: '12-25', icon: 'fluent-emoji-flat:christmas-tree', round: [1, 2, 3, 4, 5] }),
    makeHoliday({ name: 'Y2038', date: '2038-01-19', icon: 'mdi:cpu-32-bit' }),
  ];
  const yaml = dumpYaml(toPlainList(list));
  assert.match(yaml, /round: \[1, 2, 3, 4, 5\]/);
  const { items } = parseHolidaysYaml(yaml);
  assert.equal(serializeList(items.map((i) => makeHoliday(i))), serializeList(list));
  assert.equal(dumpYaml([]), '[]\n');
});

test('parse errors are reported', () => {
  assert.deepEqual(parseHolidaysYaml(''), { items: [] });
  assert.match(parseHolidaysYaml('name: x').error, /Expected a YAML list/);
  assert.match(parseHolidaysYaml('- [').error, /YAML parse error/);
  assert.match(parseHolidaysYaml('- just a string').error, /Entry 1/);
});

test('comment detection and dedupe keys', () => {
  assert.equal(yamlHasComments('# comment\n- name: a'), true);
  assert.equal(yamlHasComments('- name: a\n  date: 01-01'), false);
  assert.equal(dedupeKey({ name: ' Christmas ', date: '12-25' }), dedupeKey({ name: 'christmas', date: '12-25' }));
});

test('legacy localStorage entries are revived', () => {
  const saved = JSON.parse(JSON.stringify([makeHoliday({ name: 'a', icon: 'b', date: '05Wn1-1' })]));
  const h = reviveHoliday(saved[0]);
  assert.equal(composeDateStr(h), '05Wn1-1');
  assert.equal(h._dateType, 'lastNthWeekday');
  assert.equal(reviveHoliday({ name: 'Unknown', icon: 'x', date: 'next tuesday' })._dateInvalid, true);
});

test('repeat for all months', () => {
  const h = makeHoliday({ name: 'Pay', icon: 'b', date: '01-15', round: [1, 2, 3, 4, 5] });
  assert.equal(canDuplicateAcrossMonths(h), true);
  const dups = buildMonthDuplicates(h, today);
  assert.equal(dups.length, 12);
  assert.equal(dups[11].date, '12-15');
  assert.deepEqual(dups[11].round, [1, 2, 3, 4, 5]);
  assert.equal(canDuplicateAcrossMonths(makeHoliday({ name: 'a', icon: 'b', date: '01-01[u-ca=chinese]' })), false);
});

test('month is clamped to the calendar range', () => {
  const h = makeHoliday({ name: 'a', icon: 'b', date: '01-01' });
  h._month = 14;
  normalizeMonth(h, today);
  assert.equal(h._month, 12);
});
