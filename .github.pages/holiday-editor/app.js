// ─── Date resolution functions (ported from shared.liquid) ───

function nthWeekdayOfMonth(year, month, n, dow, cal) {
  const mc = `M${String(month).padStart(2, '0')}`;
  const first = cal
    ? Temporal.PlainDate.from({ year, monthCode: mc, day: 1, calendar: cal })
    : new Temporal.PlainDate(year, month, 1);
  const offset = (dow - first.dayOfWeek + 7) % 7;
  const day = first.add({ days: offset + (n - 1) * 7 });
  if (day.monthCode !== first.monthCode) return null;
  return cal ? day.withCalendar('iso8601') : day;
}

function lastNthWeekdayOfMonth(year, month, n, dow, cal) {
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

function roundToWeekday(date, weekdays) {
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

function resolveDate(dateStr, year) {
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

// ─── Helpers ───

const LOCALE = 'en';
// 2024-01-01 is a Monday (ISO weekday 1), so indices 0–6 map to Mon–Sun.
const DOW_NAMES = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
const DOW_FULL = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(new Date(2024, 0, 1 + i)));
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { month: 'long' }).format(new Date(2024, i, 1)));
const MONTH_SHORT_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(new Date(2024, i, 1)));
const GREGORIAN_MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({
  value: index + 1,
  label,
  shortLabel: MONTH_SHORT_NAMES[index],
}));
const monthFormatterCache = new Map();

function supportsCustomMonthSelects() {
  if (!window.CSS?.supports) return false;
  try {
    return CSS.supports('appearance: base-select')
      && CSS.supports('selector(::picker(select))')
      && CSS.supports('selector(selectedcontent)');
  } catch {
    return false;
  }
}

const CUSTOM_MONTH_SELECTS_SUPPORTED = supportsCustomMonthSelects();
document.documentElement.classList.toggle('supports-custom-month-selects', CUSTOM_MONTH_SELECTS_SUPPORTED);

function getMonthFormatter(calendar, width = 'long') {
  const cacheKey = `${calendar}:${width}`;
  if (!monthFormatterCache.has(cacheKey)) {
    monthFormatterCache.set(cacheKey, new Intl.DateTimeFormat(LOCALE, { month: width, calendar }));
  }
  return monthFormatterCache.get(cacheKey);
}

function getCalendarMonthCount(year, calendar) {
  if (!calendar) return 12;
  try {
    return Temporal.PlainDate.from({ year, monthCode: 'M01', day: 1, calendar }).monthsInYear;
  } catch {
    return 12;
  }
}

function getCalendarMonthOptions(year, calendar) {
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

function getCalendars() {
  try {
    return Intl.supportedValuesOf('calendar');
  } catch {
    return ['buddhist','chinese','coptic','dangi','ethioaa','ethiopic','gregory','hebrew','indian','islamic','islamic-civil','islamic-rgsa','islamic-tbla','islamic-umalqura','iso8601','japanese','persian','roc'];
  }
}

function parseDateStr(dateStr) {
  if (!dateStr) return { type: 'monthly', month: 1, day: 1 };
  let cal = null;
  const calMatch = dateStr.match(/\[u-ca=([^\]]+)\]$/);
  if (calMatch) {
    cal = calMatch[1];
    dateStr = dateStr.slice(0, -calMatch[0].length);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { type: 'absolute', year: y, month: m, day: d, calendar: cal };
  }
  if (/^\d{2}-\d{2}$/.test(dateStr)) {
    const [m, d] = dateStr.split('-').map(Number);
    return { type: 'monthly', month: m, day: d, calendar: cal };
  }
  const wm = dateStr.match(/^(\d{2})W(\d+)-(\d)$/);
  if (wm) return { type: 'nthWeekday', month: +wm[1], occurrence: +wm[2], weekday: +wm[3], calendar: cal };
  const wnm = dateStr.match(/^(\d{2})Wn(\d+)-(\d)$/);
  if (wnm) return { type: 'lastNthWeekday', month: +wnm[1], occurrence: +wnm[2], weekday: +wnm[3], calendar: cal };
  return { type: 'monthly', month: 1, day: 1, calendar: cal };
}

let _nextId = 1;

function makeHoliday(raw) {
  const parsed = parseDateStr(raw?.date || '');
  return {
    _id: _nextId++,
    name: raw?.name || '',
    icon: raw?.icon || '',
    round: raw?.round ? [...raw.round] : [],
    date: raw?.date || '',
    _dateType: parsed.type,
    _year: parsed.year || new Date().getFullYear(),
    _month: parsed.month || 1,
    _day: parsed.day || 1,
    _occurrence: parsed.occurrence || 1,
    _weekday: parsed.weekday || 1,
    _useCal: !!parsed.calendar,
    _calendar: parsed.calendar || 'chinese',
  };
}

// ─── Vue App ───

const { createApp, ref, computed, watch, reactive, nextTick, onMounted, onBeforeUnmount } = Vue;

createApp({
  setup() {
    const started = ref(false);
    const holidays = ref([]);
    const showYaml = ref(false);
    const showLoad = ref(false);
    const loadYamlText = ref('');
    const loadError = ref('');
    const copyLabel = ref('Copy');

    const calendars = getCalendars();
    const gregorianMonthOptions = GREGORIAN_MONTH_OPTIONS;

    const dateFormats = [
      { value: 'absolute', label: 'Absolute (YYYY-MM-DD)' },
      { value: 'monthly', label: 'Annually (MM-DD)' },
      { value: 'nthWeekday', label: 'Nth Weekday of a month' },
      { value: 'lastNthWeekday', label: 'Last Nth Weekday of a month' },
    ];

    const today = Temporal.Now.plainDateISO();

    // Auto-save to localStorage
    watch(holidays, (val) => {
      if (started.value) {
        try {
          localStorage.setItem('trmnl-holiday-editor', JSON.stringify(val));
        } catch {}
      }
    }, { deep: true });

    // Try restore from localStorage
    try {
      const saved = localStorage.getItem('trmnl-holiday-editor');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          holidays.value = parsed.map(h => {
            h._id = _nextId++;
            return h;
          });
          started.value = true;
          openAndScrollTo(holidays.value[0]._id);
        }
      }
    } catch {}

    // Compose date string from UI fields
    function composeDateStr(h) {
      let base = '';
      switch (h._dateType) {
        case 'absolute':
          if (h._year && h._month && h._day)
            base = `${h._year}-${String(h._month).padStart(2,'0')}-${String(h._day).padStart(2,'0')}`;
          break;
        case 'monthly':
          if (h._month && h._day)
            base = `${String(h._month).padStart(2,'0')}-${String(h._day).padStart(2,'0')}`;
          break;
        case 'nthWeekday':
          if (h._month && h._occurrence && h._weekday)
            base = `${String(h._month).padStart(2,'0')}W${h._occurrence}-${h._weekday}`;
          break;
        case 'lastNthWeekday':
          if (h._month && h._occurrence && h._weekday)
            base = `${String(h._month).padStart(2,'0')}Wn${h._occurrence}-${h._weekday}`;
          break;
      }
      if (!base) return '';
      if (h._useCal && h._calendar) base += `[u-ca=${h._calendar}]`;
      return base;
    }

    function calendarMonthCount(h) {
      if (!h._useCal || !h._calendar) return 12;
      const fallbackYear = today.withCalendar(h._calendar).year;
      const year = h._dateType === 'absolute'
        ? Number(h._year) || fallbackYear
        : fallbackYear;
      return getCalendarMonthCount(year, h._calendar);
    }

    function absoluteMonthOptions(h) {
      if (!h._useCal || !h._calendar) return GREGORIAN_MONTH_OPTIONS;
      const year = Number(h._year) || today.withCalendar(h._calendar).year;
      return getCalendarMonthOptions(year, h._calendar);
    }

    function normalizeMonth(h) {
      const maxMonth = calendarMonthCount(h);
      const month = Number(h._month);
      if (!Number.isFinite(month) || month < 1) {
        h._month = 1;
        return;
      }
      if (month > maxMonth) {
        h._month = maxMonth;
      }
    }

    function updateMonthPickerLayouts() {
      if (!CUSTOM_MONTH_SELECTS_SUPPORTED) return;
      nextTick(() => {
        const selects = document.querySelectorAll('select.month-select');
        for (const select of selects) {
          const container = select.closest('.month-field') || select.parentElement;
          const gap = parseFloat(getComputedStyle(document.documentElement).fontSize || '16') * 0.5;
          const containerWidth = container?.clientWidth || select.clientWidth || 0;
          const minSize = Math.max(56, Math.floor((Math.max(containerWidth, 0) - gap * 5) / 4) );

          select.style.setProperty('--month-picker-min-size', `${minSize}px`);
        }
      });
    }

    // Keep h.date in sync with composed value
    watch(holidays, () => {
      for (const h of holidays.value) {
        normalizeMonth(h);
        const d = composeDateStr(h);
        if (d) h.date = d;
      }
      updateMonthPickerLayouts();
    }, { deep: true });

    onMounted(() => {
      updateMonthPickerLayouts();
      if (CUSTOM_MONTH_SELECTS_SUPPORTED) {
        window.addEventListener('resize', updateMonthPickerLayouts);
      }
    });

    onBeforeUnmount(() => {
      if (CUSTOM_MONTH_SELECTS_SUPPORTED) {
        window.removeEventListener('resize', updateMonthPickerLayouts);
      }
    });

    // Compute upcoming dates for a holiday
    function upcomingDates(h) {
      if (!h.date) return [];
      const results = [];
      const isFixed = /^\d{4}/.test(h.date);
      const startYear = today.year;
      const endYear = isFixed ? startYear : startYear + 6;
      for (let y = startYear; y <= endYear; y++) {
        try {
          let d = resolveDate(h.date, y);
          if (!d) continue;
          if (h.round && h.round.length > 0) d = roundToWeekday(d, h.round);
          const diff = today.until(d, { largestUnit: 'day' }).days;
          if (diff >= 0) {
            results.push({
              iso: d.toString(),
              dow: DOW_FULL[d.dayOfWeek - 1],
              days: diff,
            });
          }
        } catch {}
      }
      // Deduplicate by iso
      const seen = new Set();
      const unique = [];
      for (const r of results) {
        if (!seen.has(r.iso)) { seen.add(r.iso); unique.push(r); }
      }
      return unique.slice(0, 5);
    }

    // Generate YAML
    const generatedYaml = computed(() => {
      const clean = holidays.value.map(h => {
        const obj = { name: h.name, date: h.date, icon: h.icon };
        if (h.round && h.round.length > 0) obj.round = [...h.round].sort((a,b) => a-b);
        return obj;
      });
      return jsyaml.dump(clean, { lineWidth: -1, quotingType: '"', flowLevel: 2 });
    });

    // Helpers
    function openAndScrollTo(id) {
      nextTick(() => {
        const el = document.querySelector(`details.holiday-card[data-id="${id}"]`);
        if (el) {
          el.open = true;
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // CRUD
    function addHoliday() {
      const h = makeHoliday();
      holidays.value.push(h);
      openAndScrollTo(h._id);
    }
    function remove(idx) {
      holidays.value.splice(idx, 1);
    }
    function move(idx, dir) {
      const target = idx + dir;
      if (target < 0 || target >= holidays.value.length) return;
      const arr = holidays.value;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
    }
    function startFresh() {
      holidays.value = [];
      started.value = true;
      showYaml.value = false;
      const h = makeHoliday();
      holidays.value.push(h);
      openAndScrollTo(h._id);
    }
    function loadYaml() {
      loadError.value = '';
      try {
        const parsed = jsyaml.load(loadYamlText.value);
        if (!Array.isArray(parsed)) {
          loadError.value = 'Expected a YAML list (array) of holidays.';
          return;
        }
        holidays.value = parsed.map(h => makeHoliday(h));
        started.value = true;
        showLoad.value = false;
        loadYamlText.value = '';
        if (holidays.value.length) openAndScrollTo(holidays.value[0]._id);
      } catch (e) {
        loadError.value = 'YAML parse error: ' + e.message;
      }
    }
    async function copyYaml() {
      try {
        await navigator.clipboard.writeText(generatedYaml.value);
        copyLabel.value = 'Copied!';
        setTimeout(() => { copyLabel.value = 'Copy'; }, 2000);
      } catch {
        copyLabel.value = 'Failed';
        setTimeout(() => { copyLabel.value = 'Copy'; }, 2000);
      }
    }

    // Icon picker
    const iconPicker = reactive({
      open: false,
      query: '',
      results: [],
      loading: false,
      searched: false,
      targetIdx: -1,
      hovered: '',
    });
    let iconSearchTimer = null;
    function openIconPicker(idx) {
      iconPicker.targetIdx = idx;
      iconPicker.query = '';
      iconPicker.results = [];
      iconPicker.searched = false;
      iconPicker.open = true;
    }
    function debouncedIconSearch() {
      clearTimeout(iconSearchTimer);
      const q = iconPicker.query.trim();
      if (!q) { iconPicker.results = []; iconPicker.searched = false; return; }
      iconSearchTimer = setTimeout(() => searchIcons(q), 300);
    }
    async function searchIcons(q) {
      iconPicker.loading = true;
      iconPicker.searched = true;
      try {
        const url = `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=128`;
        const res = await fetch(url);
        const data = await res.json();
        iconPicker.results = data.icons || [];
      } catch {
        iconPicker.results = [];
      } finally {
        iconPicker.loading = false;
      }
    }
    function selectIcon(name) {
      if (iconPicker.targetIdx >= 0 && iconPicker.targetIdx < holidays.value.length) {
        holidays.value[iconPicker.targetIdx].icon = name;
      }
      iconPicker.open = false;
    }

    // Validation
    function holidayErrors(h) {
      const errs = [];
      if (!h.name || !h.name.trim()) errs.push('Name is required');
      if (!h.icon || !h.icon.trim()) errs.push('Icon is required');
      if (!composeDateStr(h)) errs.push('Date is required');
      return errs;
    }
    const hasAnyErrors = computed(() => holidays.value.some(h => holidayErrors(h).length > 0));

    // Helpers
    function monthName(m) { return MONTH_NAMES[m - 1]; }
    function dowName(d) { return DOW_NAMES[d - 1]; }
    const calendarDisplayNames = new Intl.DisplayNames(LOCALE, { type: 'calendar' });
    function calendarName(id) {
      try { return calendarDisplayNames.of(id); } catch { return id; }
    }
    const ordinalFmt = new Intl.PluralRules(LOCALE, { type: 'ordinal' });
    const ordinalSuffixes = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
    function ordinal(n) {
      return n + ordinalSuffixes[ordinalFmt.select(n)];
    }

    return {
      started, holidays, showYaml, showLoad, loadYamlText, loadError,
      copyLabel, calendars, dateFormats, today, iconPicker, gregorianMonthOptions,
      composeDateStr, upcomingDates, generatedYaml, holidayErrors, hasAnyErrors,
      addHoliday, remove, move, startFresh, loadYaml, copyYaml,
      openIconPicker, debouncedIconSearch, selectIcon,
      monthName, dowName, ordinal, calendarName, calendarMonthCount, absoluteMonthOptions,
    };
  }
}).mount('#app');
