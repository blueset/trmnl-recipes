// Date resolution — mirrors custom-next-holiday/src/shared.liquid. Keep both in sync.
// Requires a global `Temporal` (temporal-polyfill in the browser and in tests).

export function nthWeekdayOfMonth(year, month, n, dow, cal) {
  const mc = `M${String(month).padStart(2, '0')}`;
  const first = cal
    ? Temporal.PlainDate.from({ year, monthCode: mc, day: 1, calendar: cal })
    : new Temporal.PlainDate(year, month, 1);
  const offset = (dow - first.dayOfWeek + 7) % 7;
  const day = first.add({ days: offset + (n - 1) * 7 });
  if (day.monthCode !== first.monthCode) return null;
  return cal ? day.withCalendar('iso8601') : day;
}

export function lastNthWeekdayOfMonth(year, month, n, dow, cal) {
  const mc = `M${String(month).padStart(2, '0')}`;
  const first = cal
    ? Temporal.PlainDate.from({ year, monthCode: mc, day: 1, calendar: cal })
    : new Temporal.PlainDate(year, month, 1);
  const last = cal
    ? Temporal.PlainDate.from({ year, monthCode: mc, day: first.daysInMonth, calendar: cal })
    : new Temporal.PlainDate(year, month, first.daysInMonth);
  const offset = (last.dayOfWeek - dow + 7) % 7;
  const day = last.subtract({ days: offset + (n - 1) * 7 });
  if (day.monthCode !== first.monthCode) return null;
  return cal ? day.withCalendar('iso8601') : day;
}

export function roundToWeekday(date, weekdays) {
  if (weekdays.includes(date.dayOfWeek)) return date;
  let bestDist = 8;
  let bestDate = date;
  for (const dow of weekdays) {
    const fwd = (dow - date.dayOfWeek + 7) % 7 || 7;
    const bwd = (date.dayOfWeek - dow + 7) % 7 || 7;
    if (fwd < bestDist) { bestDist = fwd; bestDate = date.add({ days: fwd }); }
    if (bwd < bestDist) { bestDist = bwd; bestDate = date.subtract({ days: bwd }); }
  }
  return bestDate;
}

export function resolveDate(dateStr, year) {
  let cal = null;
  const calMatch = dateStr.match(/\[u-ca=([^\]]+)\]$/);
  if (calMatch) {
    cal = calMatch[1];
    dateStr = dateStr.slice(0, -calMatch[0].length);
  }
  function calYear() {
    return new Temporal.PlainDate(year, 7, 1).withCalendar(cal).year;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    if (cal) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const mc = `M${String(m).padStart(2, '0')}`;
      return Temporal.PlainDate.from({ year: y, monthCode: mc, day: d, calendar: cal })
        .withCalendar('iso8601');
    }
    return Temporal.PlainDate.from(dateStr);
  }
  if (/^\d{2}-\d{2}$/.test(dateStr)) {
    const [m, d] = dateStr.split('-').map(Number);
    if (cal) {
      const mc = `M${String(m).padStart(2, '0')}`;
      return Temporal.PlainDate.from({ year: calYear(), monthCode: mc, day: d, calendar: cal })
        .withCalendar('iso8601');
    }
    return new Temporal.PlainDate(year, m, d);
  }
  const wm = dateStr.match(/^(\d{2})W(\d+)-(\d)$/);
  if (wm)
    return nthWeekdayOfMonth(cal ? calYear() : year, +wm[1], +wm[2], +wm[3], cal);
  const wnm = dateStr.match(/^(\d{2})Wn(\d+)-(\d)$/);
  if (wnm)
    return lastNthWeekdayOfMonth(cal ? calYear() : year, +wnm[1], +wnm[2], +wnm[3], cal);
  return null;
}

/**
 * Upcoming occurrences of a date expression, starting at `today` (inclusive).
 * @returns {{ date: Temporal.PlainDate, iso: string, days: number }[]}
 */
export function upcomingOccurrences(dateStr, round, today, limit = 5) {
  if (!dateStr) return [];
  const results = [];
  const isFixed = /^\d{4}/.test(dateStr);
  const startYear = today.year;
  const endYear = isFixed ? startYear : startYear + 6;
  for (let y = startYear; y <= endYear; y++) {
    try {
      let d = resolveDate(dateStr, y);
      if (!d) continue;
      if (round && round.length > 0) d = roundToWeekday(d, round);
      const days = today.until(d, { largestUnit: 'day' }).days;
      if (days >= 0) results.push({ date: d, iso: d.toString(), days });
    } catch {}
  }
  const seen = new Set();
  const unique = [];
  for (const r of results.sort((a, b) => a.days - b.days)) {
    if (!seen.has(r.iso)) { seen.add(r.iso); unique.push(r); }
  }
  return unique.slice(0, limit);
}
