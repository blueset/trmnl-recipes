// Locale-aware labels and calendar helpers (no DOM access).

export const LOCALE = 'en';

// 2024-01-01 is a Monday (ISO weekday 1), so indices 0–6 map to Mon–Sun.
export const DOW_NAMES = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
export const DOW_FULL = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(new Date(2024, 0, 1 + i)));
export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { month: 'long' }).format(new Date(2024, i, 1)));
export const MONTH_SHORT_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(new Date(2024, i, 1)));
export const GREGORIAN_MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({
  value: index + 1,
  label,
  shortLabel: MONTH_SHORT_NAMES[index],
}));
export const DISJUNCT_LIST_FORMATTER = new Intl.ListFormat(LOCALE, { type: 'disjunction' });

const monthFormatterCache = new Map();

function getMonthFormatter(calendar, width = 'long') {
  const cacheKey = `${calendar}:${width}`;
  if (!monthFormatterCache.has(cacheKey)) {
    monthFormatterCache.set(cacheKey, new Intl.DateTimeFormat(LOCALE, { month: width, calendar }));
  }
  return monthFormatterCache.get(cacheKey);
}

export function getCalendarMonthCount(year, calendar) {
  if (!calendar) return 12;
  try {
    return Temporal.PlainDate.from({ year, monthCode: 'M01', day: 1, calendar }).monthsInYear;
  } catch {
    return 12;
  }
}

export function getCalendarMonthOptions(year, calendar) {
  if (!calendar) return GREGORIAN_MONTH_OPTIONS;
  const formatter = getMonthFormatter(calendar, 'long');
  const shortFormatter = getMonthFormatter(calendar, 'short');
  const monthCount = getCalendarMonthCount(year, calendar);
  const options = [];

  for (let month = 1; month <= monthCount; month++) {
    let label = `Month ${month}`;
    let shortLabel = label;
    try {
      const monthDate = Temporal.PlainDate.from({
        year,
        monthCode: `M${String(month).padStart(2, '0')}`,
        day: 1,
        calendar,
      });
      label = formatter.format(monthDate);
      shortLabel = shortFormatter.format(monthDate);
    } catch {
      try {
        const monthDate = Temporal.PlainDate.from({ year, month, day: 1, calendar });
        label = formatter.format(monthDate);
        shortLabel = shortFormatter.format(monthDate);
      } catch {}
    }
    options.push({ value: month, label, shortLabel });
  }

  return options;
}

export function getCalendars() {
  try {
    return Intl.supportedValuesOf('calendar');
  } catch {
    return ['buddhist','chinese','coptic','dangi','ethioaa','ethiopic','gregory','hebrew','indian','islamic','islamic-civil','islamic-rgsa','islamic-tbla','islamic-umalqura','iso8601','japanese','persian','roc'];
  }
}

export function isGregorianCalendarId(calendar) {
  return !calendar || calendar === 'gregory' || calendar === 'gregorian' || calendar === 'iso8601';
}

const calendarDisplayNames = new Intl.DisplayNames(LOCALE, { type: 'calendar' });
export function calendarName(id) {
  try { return calendarDisplayNames.of(id); } catch { return id; }
}

const ordinalFmt = new Intl.PluralRules(LOCALE, { type: 'ordinal' });
const ordinalSuffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
export function ordinal(n) {
  return n + ordinalSuffixes[ordinalFmt.select(n)];
}

export function dowName(d) { return DOW_NAMES[d - 1]; }
export function monthName(m) { return MONTH_NAMES[m - 1]; }
