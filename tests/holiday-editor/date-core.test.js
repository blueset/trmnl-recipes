import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDate, roundToWeekday, upcomingOccurrences } from '../../.github.pages/holiday-editor/js/date-core.js';

const iso = (d) => d && d.toString();
const today = Temporal.PlainDate.from('2026-01-01');

test('absolute and annual dates', () => {
  assert.equal(iso(resolveDate('2038-01-19', 2026)), '2038-01-19');
  assert.equal(iso(resolveDate('12-25', 2026)), '2026-12-25');
});

test('n-th and last n-th weekday of month', () => {
  assert.equal(iso(resolveDate('11W4-4', 2026)), '2026-11-26'); // Thanksgiving
  assert.equal(iso(resolveDate('05Wn1-1', 2026)), '2026-05-25'); // Memorial Day
  assert.equal(iso(resolveDate('03W2-7', 2026)), '2026-03-08'); // US DST start
  assert.equal(iso(resolveDate('10Wn1-7', 2026)), '2026-10-25'); // EU DST end
  assert.equal(resolveDate('02W5-1', 2026), null); // no 5th Monday in Feb 2026
});

test('non-Gregorian calendars', () => {
  // 2027 is avoided: the new moon is minutes before midnight in Beijing and ICU data disagrees.
  assert.equal(iso(resolveDate('01-01[u-ca=chinese]', 2028)), '2028-01-26');
  assert.equal(iso(resolveDate('08-15[u-ca=chinese]', 2026)), '2026-09-25');
  assert.equal(iso(resolveDate('07-15[u-ca=hebrew]', 2026)), '2026-04-02'); // Passover
});

test('rounding to allowed weekdays', () => {
  const sat = Temporal.PlainDate.from('2026-07-04');
  assert.equal(iso(roundToWeekday(sat, [1, 2, 3, 4, 5])), '2026-07-03');
  const sun = Temporal.PlainDate.from('2027-07-04');
  assert.equal(iso(roundToWeekday(sun, [1, 2, 3, 4, 5])), '2027-07-05');
  assert.equal(iso(roundToWeekday(sat, [6])), '2026-07-04');
});

test('upcoming occurrences are sorted, unique and limited', () => {
  const up = upcomingOccurrences('12-25', [], today, 3);
  assert.deepEqual(up.map((o) => o.iso), ['2026-12-25', '2027-12-25', '2028-12-25']);
  assert.equal(up[0].days, 358);
  assert.deepEqual(upcomingOccurrences('2020-01-01', [], today), []);
  assert.deepEqual(upcomingOccurrences('', [], today), []);
  const cny = upcomingOccurrences('01-01[u-ca=chinese]', [], today, 1).map((o) => o.iso);
  assert.deepEqual(cny, ['2026-02-17']);
});
