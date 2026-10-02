import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHoliday } from '../../.github.pages/holiday-editor/js/holiday-model.js';
import { describeHoliday, nextOccurrence, displayDate } from '../../.github.pages/holiday-editor/js/holiday-summary.js';

test('human date summaries preserve annual, absolute, and weekday distinctions', () => {
  const summary = date => describeHoliday(makeHoliday({ name: 'x', icon: 'x', date }));
  assert.equal(summary('12-25'), 'December 25 every year');
  assert.equal(summary('2038-01-19'), 'January 19, 2038');
  assert.equal(summary('08W2-5'), '2nd Friday of August');
  assert.equal(summary('05Wn1-1'), 'Last Monday of May');
  assert.equal(summary('05Wn2-1'), '2nd-to-last Monday of May');
  assert.match(summary('01-01[u-ca=chinese]'), /month 1 \(Chinese Calendar\)/);
  assert.equal(summary('unknown'), 'Unrecognized date: unknown');
});

test('next date uses the existing rounding engine and date labels are timezone independent', () => {
  const h = makeHoliday({ name: 'x', icon: 'x', date: '07-04', round: [1,2,3,4,5] });
  assert.equal(nextOccurrence(h, Temporal.PlainDate.from('2026-01-01')).iso, '2026-07-03');
  assert.equal(displayDate('2038-01-19'), 'Jan 19, 2038');
});
