import { composeDateStr } from './holiday-model.js';
import { calendarName, ordinal, DOW_FULL, MONTH_NAMES } from './calendar-utils.js';
import { upcomingOccurrences } from './date-core.js';

export function describeHoliday(h) {
  if (h._dateInvalid) return `Unrecognized date: ${h.date}`;
  const month = h._useCal ? `month ${h._month} (${calendarName(h._calendar)})` : MONTH_NAMES[h._month - 1];
  if (h._dateType === 'absolute') return `${month} ${h._day}, ${h._year}`;
  if (h._dateType === 'monthly') return `${month} ${h._day} every year`;
  const weekday = DOW_FULL[h._weekday - 1];
  const occurrence = h._dateType === 'lastNthWeekday'
    ? (h._occurrence === 1 ? 'Last' : `${ordinal(h._occurrence)}-to-last`) : ordinal(h._occurrence);
  return `${occurrence} ${weekday} of ${month}`;
}

export function nextOccurrence(h, today) {
  return upcomingOccurrences(composeDateStr(h), h.round, today, 1)[0] || null;
}

export function displayDate(iso) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}
