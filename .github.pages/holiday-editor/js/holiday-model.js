// Holiday list model: parse/compose date strings, editable holiday objects, YAML I/O.
// Requires globals `Temporal` and `jsyaml`.

import { getCalendarMonthCount, isGregorianCalendarId } from './calendar-utils.js';
import jsyaml from 'js-yaml';

export const DEFAULT_ICON = 'fluent:calendar-20-regular';

export const DATE_FORMATS = [
  { value: 'absolute', label: 'Absolute (YYYY-MM-DD)' },
  { value: 'monthly', label: 'Annually (MM-DD)' },
  { value: 'nthWeekday', label: 'Nth Weekday of a month' },
  { value: 'lastNthWeekday', label: 'Last Nth Weekday of a month' },
];

const pad2 = (n) => String(n).padStart(2, '0');

/** Parse a date expression. `invalid: true` when the string is non-empty but unrecognized. */
export function parseDateStr(dateStr) {
  if (!dateStr) return { type: 'monthly', month: 1, day: 1, calendar: null, invalid: false };
  let cal = null;
  let rest = String(dateStr);
  const calMatch = rest.match(/\[u-ca=([^\]]+)\]$/);
  if (calMatch) {
    cal = calMatch[1];
    rest = rest.slice(0, -calMatch[0].length);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(rest)) {
    const [y, m, d] = rest.split('-').map(Number);
    return { type: 'absolute', year: y, month: m, day: d, calendar: cal, invalid: false };
  }
  if (/^\d{2}-\d{2}$/.test(rest)) {
    const [m, d] = rest.split('-').map(Number);
    return { type: 'monthly', month: m, day: d, calendar: cal, invalid: false };
  }
  const wm = rest.match(/^(\d{2})W(\d+)-(\d)$/);
  if (wm) return { type: 'nthWeekday', month: +wm[1], occurrence: +wm[2], weekday: +wm[3], calendar: cal, invalid: false };
  const wnm = rest.match(/^(\d{2})Wn(\d+)-(\d)$/);
  if (wnm) return { type: 'lastNthWeekday', month: +wnm[1], occurrence: +wnm[2], weekday: +wnm[3], calendar: cal, invalid: false };
  return { type: 'monthly', month: 1, day: 1, calendar: cal, invalid: true };
}

let nextId = 1;

/** Create an editable holiday (UI state lives in `_`-prefixed fields). */
export function makeHoliday(raw) {
  // js-yaml parses unquoted YYYY-MM-DD scalars into Date objects.
  const date = raw?.date == null ? ''
    : raw.date instanceof Date && !isNaN(raw.date) ? raw.date.toISOString().slice(0, 10)
    : String(raw.date);
  const parsed = parseDateStr(date);
  return {
    _id: nextId++,
    name: raw?.name == null ? '' : String(raw.name),
    icon: raw?.icon == null ? '' : String(raw.icon),
    round: Array.isArray(raw?.round) ? raw.round.map(Number).filter(n => n >= 1 && n <= 7) : [],
    date,
    _dateType: parsed.type,
    _year: parsed.year || new Date().getFullYear(),
    _month: parsed.month || 1,
    _day: parsed.day || 1,
    _occurrence: parsed.occurrence || 1,
    _weekday: parsed.weekday || 1,
    _useCal: !!parsed.calendar,
    _calendar: parsed.calendar || 'chinese',
    // Keep an unrecognized date verbatim until the user edits the date fields.
    _dateInvalid: parsed.invalid,
  };
}

/** Re-hydrate holidays saved by an older editor version (same shape, fresh ids). */
export function reviveHoliday(saved) {
  const h = makeHoliday(saved);
  for (const key of ['_dateType', '_year', '_month', '_day', '_occurrence', '_weekday', '_useCal', '_calendar']) {
    if (saved && saved[key] !== undefined) h[key] = saved[key];
  }
  if (saved?._dateInvalid !== undefined) h._dateInvalid = !!saved._dateInvalid;
  return h;
}

export function composeDateStr(h) {
  if (h._dateInvalid) return h.date;
  let base = '';
  switch (h._dateType) {
    case 'absolute':
      if (h._year && h._month && h._day) base = `${h._year}-${pad2(h._month)}-${pad2(h._day)}`;
      break;
    case 'monthly':
      if (h._month && h._day) base = `${pad2(h._month)}-${pad2(h._day)}`;
      break;
    case 'nthWeekday':
      if (h._month && h._occurrence && h._weekday) base = `${pad2(h._month)}W${h._occurrence}-${h._weekday}`;
      break;
    case 'lastNthWeekday':
      if (h._month && h._occurrence && h._weekday) base = `${pad2(h._month)}Wn${h._occurrence}-${h._weekday}`;
      break;
  }
  if (!base) return '';
  if (h._useCal && h._calendar) base += `[u-ca=${h._calendar}]`;
  return base;
}

export function holidayErrors(h) {
  const errs = [];
  if (!h.name || !h.name.trim()) errs.push('Name is required');
  if (!h.icon || !h.icon.trim()) errs.push('Icon is required');
  if (h._dateInvalid) errs.push(`Unrecognized date "${h.date}"`);
  else if (!composeDateStr(h)) errs.push('Date is required');
  return errs;
}

/** Plain recipe entry: { name, date, icon, round? } */
export function toPlain(h) {
  const obj = { name: h.name, date: composeDateStr(h) || h.date, icon: h.icon };
  if (h.round && h.round.length > 0) obj.round = [...new Set(h.round)].sort((a, b) => a - b);
  return obj;
}

export const toPlainList = (list) => list.map(toPlain);

export function dumpYaml(plainList) {
  if (!plainList.length) return '[]\n';
  return jsyaml.dump(plainList, { lineWidth: -1, quotingType: '"', flowLevel: 2 });
}

/** Stable key used for dirty checks. */
export const serializeList = (list) => JSON.stringify(toPlainList(list));

export const dedupeKey = (plain) => `${String(plain.name || '').trim().toLowerCase()}|${plain.date || ''}`;

export function yamlHasComments(text) {
  return /(^|\s)#/m.test(text || '');
}

/**
 * Parse a holidays YAML document.
 * @returns {{ items: object[] } | { error: string }}
 */
export function parseHolidaysYaml(text) {
  if (text == null || !String(text).trim()) return { items: [] };
  let parsed;
  try {
    parsed = jsyaml.load(String(text));
  } catch (e) {
    return { error: 'YAML parse error: ' + e.message };
  }
  if (parsed == null) return { items: [] };
  if (!Array.isArray(parsed)) return { error: 'Expected a YAML list (array) of holidays.' };
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: `Entry ${i + 1} is not a mapping with name/date/icon.` };
    }
  }
  return { items: parsed };
}

// ─── Month helpers (repeat for all months) ───

export function calendarMonthCount(h, today) {
  if (!h._useCal || !h._calendar) return 12;
  const fallbackYear = today.withCalendar(h._calendar).year;
  const year = h._dateType === 'absolute' ? Number(h._year) || fallbackYear : fallbackYear;
  return getCalendarMonthCount(year, h._calendar);
}

export function isGregorianHoliday(h) {
  return !h._useCal || isGregorianCalendarId(h._calendar);
}

export function canDuplicateAcrossMonths(h) {
  return !h._dateInvalid && (h._dateType === 'absolute' || isGregorianHoliday(h));
}

export function monthDuplicationCount(h, today) {
  return h._dateType === 'absolute' ? calendarMonthCount(h, today) : 12;
}

function buildMonthDuplicateDate(h, month) {
  let base = '';
  if (h._dateType === 'absolute') base = `${h._year}-${pad2(month)}-${pad2(h._day)}`;
  else if (h._dateType === 'monthly') base = `${pad2(month)}-${pad2(h._day)}`;
  else if (h._dateType === 'nthWeekday') base = `${pad2(month)}W${h._occurrence}-${h._weekday}`;
  else if (h._dateType === 'lastNthWeekday') base = `${pad2(month)}Wn${h._occurrence}-${h._weekday}`;
  if (h._useCal && h._calendar) base += `[u-ca=${h._calendar}]`;
  return base;
}

export function buildMonthDuplicates(h, today) {
  const count = monthDuplicationCount(h, today);
  return Array.from({ length: count }, (_, index) => makeHoliday({
    name: h.name,
    icon: h.icon,
    round: h.round ? [...h.round] : [],
    date: buildMonthDuplicateDate(h, index + 1),
  }));
}

/** Clamp month into the selected calendar's range. Mutates `h`. */
export function normalizeMonth(h, today) {
  const maxMonth = calendarMonthCount(h, today);
  const month = Number(h._month);
  if (!Number.isFinite(month) || month < 1) h._month = 1;
  else if (month > maxMonth) h._month = maxMonth;
}
