// Reusable holiday-list templates for the Custom Next Holiday recipe.
// Entries only use formats the recipe supports: YYYY-MM-DD, MM-DD, MMWn-D, MMWnN-D,
// optional [u-ca=calendar] suffix and optional `round` weekdays. Requires a global `Temporal`.

const WEEKDAYS = [1, 2, 3, 4, 5];
const pad2 = (n) => String(n).padStart(2, '0');
const months = (fn) => Array.from({ length: 12 }, (_, i) => fn(i + 1));
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, i, 1)));

/** Parse "1, 15, last" into [1, 15, 'last']; returns null when any part is invalid. */
export function parseDayList(text) {
  const parts = String(text ?? '').split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) return null;
  const out = [];
  for (const part of parts) {
    if (/^last$/i.test(part)) { out.push('last'); continue; }
    const n = Number(part);
    if (!Number.isInteger(n) || n < 1 || n > 31) return null;
    out.push(n);
  }
  return out;
}

export const TEMPLATE_CATEGORIES = [
  { id: 'public', title: 'Public holidays' },
  { id: 'cultural', title: 'Cultural & religious' },
  { id: 'celebrations', title: 'Celebrations' },
  { id: 'clock', title: 'Clock & seasons' },
  { id: 'personal', title: 'Personal' },
  { id: 'money', title: 'Money & admin' },
  { id: 'work', title: 'Work & school' },
  { id: 'fun', title: 'Fun & geeky' },
];

/**
 * @typedef {{ name: string, date: string, icon: string, round?: number[] }} TemplateEntry
 * @typedef {{ key: string, label: string, type: 'text'|'monthday'|'date'|'number'|'days'|'weekday'|'occurrence'|'boolean'|'icon',
 *             default: any, min?: number, max?: number, help?: string }} TemplateParam
 * @typedef {{ id: string, category: string, title: string, description: string, icon: string,
 *             tags?: string[], notes?: string, params?: TemplateParam[],
 *             entries: TemplateEntry[] | ((params: object, ctx: { today: Temporal.PlainDate }) => TemplateEntry[]) }} Template
 */

/** @type {Template[]} */
export const TEMPLATES = [
  // ─── Public holidays ───
  {
    id: 'us-federal',
    category: 'public',
    title: 'United States federal holidays',
    description: 'All 11 federal holidays. Fixed-date holidays use weekday rounding to approximate the observed day.',
    icon: 'twemoji:flag-united-states',
    tags: ['usa', 'america', 'government', 'observed'],
    entries: [
      { name: "New Year's Day", date: '01-01', icon: 'fluent-emoji-flat:party-popper', round: WEEKDAYS },
      { name: 'Martin Luther King Jr. Day', date: '01W3-1', icon: 'fluent-emoji-flat:dove' },
      { name: "Washington's Birthday", date: '02W3-1', icon: 'fluent-emoji-flat:classical-building' },
      { name: 'Memorial Day', date: '05Wn1-1', icon: 'twemoji:flag-united-states' },
      { name: 'Juneteenth', date: '06-19', icon: 'fluent-emoji-flat:raised-fist', round: WEEKDAYS },
      { name: 'Independence Day', date: '07-04', icon: 'fluent-emoji-flat:fireworks', round: WEEKDAYS },
      { name: 'Labor Day', date: '09W1-1', icon: 'fluent-emoji-flat:hammer-and-wrench' },
      { name: 'Columbus Day', date: '10W2-1', icon: 'fluent-emoji-flat:sailboat' },
      { name: 'Veterans Day', date: '11-11', icon: 'fluent-emoji-flat:military-medal', round: WEEKDAYS },
      { name: 'Thanksgiving', date: '11W4-4', icon: 'fluent-emoji-flat:turkey' },
      { name: 'Christmas Day', date: '12-25', icon: 'fluent-emoji-flat:christmas-tree', round: WEEKDAYS },
    ],
  },
  {
    id: 'uk-england',
    category: 'public',
    title: 'UK bank holidays (England & Wales)',
    description: 'Fixed and Monday bank holidays.',
    icon: 'twemoji:flag-united-kingdom',
    tags: ['uk', 'britain', 'england', 'wales', 'bank holiday'],
    notes: 'Good Friday and Easter Monday depend on Easter and cannot be expressed. Substitute days (moving to the following Monday) are not applied.',
    entries: [
      { name: "New Year's Day", date: '01-01', icon: 'fluent-emoji-flat:party-popper' },
      { name: 'Early May bank holiday', date: '05W1-1', icon: 'fluent-emoji-flat:tulip' },
      { name: 'Spring bank holiday', date: '05Wn1-1', icon: 'fluent-emoji-flat:blossom' },
      { name: 'Summer bank holiday', date: '08Wn1-1', icon: 'fluent-emoji-flat:sun' },
      { name: 'Christmas Day', date: '12-25', icon: 'fluent-emoji-flat:christmas-tree' },
      { name: 'Boxing Day', date: '12-26', icon: 'fluent-emoji-flat:wrapped-gift' },
    ],
  },
  {
    id: 'canada',
    category: 'public',
    title: 'Canada federal statutory holidays',
    description: 'Federal statutory holidays (provincial holidays vary).',
    icon: 'twemoji:flag-canada',
    tags: ['canada', 'statutory'],
    notes: 'Good Friday depends on Easter and cannot be expressed.',
    entries: [
      { name: "New Year's Day", date: '01-01', icon: 'fluent-emoji-flat:party-popper' },
      { name: 'Victoria Day', date: '05Wn2-1', icon: 'fluent-emoji-flat:crown' },
      { name: 'Canada Day', date: '07-01', icon: 'fluent-emoji-flat:maple-leaf' },
      { name: 'Labour Day', date: '09W1-1', icon: 'fluent-emoji-flat:hammer-and-wrench' },
      { name: 'National Day for Truth and Reconciliation', date: '09-30', icon: 'fluent-emoji-flat:orange-heart' },
      { name: 'Thanksgiving', date: '10W2-1', icon: 'fluent-emoji-flat:turkey' },
      { name: 'Remembrance Day', date: '11-11', icon: 'fluent-emoji-flat:rosette' },
      { name: 'Christmas Day', date: '12-25', icon: 'fluent-emoji-flat:christmas-tree' },
      { name: 'Boxing Day', date: '12-26', icon: 'fluent-emoji-flat:wrapped-gift' },
    ],
  },
  {
    id: 'australia',
    category: 'public',
    title: 'Australia national public holidays',
    description: "National holidays plus the King's Birthday observed in most states.",
    icon: 'twemoji:flag-australia',
    tags: ['australia', 'aus'],
    notes: 'Good Friday, Easter Saturday and Easter Monday depend on Easter and cannot be expressed.',
    entries: [
      { name: "New Year's Day", date: '01-01', icon: 'fluent-emoji-flat:party-popper' },
      { name: 'Australia Day', date: '01-26', icon: 'twemoji:flag-australia' },
      { name: 'Anzac Day', date: '04-25', icon: 'fluent-emoji-flat:rosette' },
      { name: "King's Birthday", date: '06W2-1', icon: 'fluent-emoji-flat:crown' },
      { name: 'Christmas Day', date: '12-25', icon: 'fluent-emoji-flat:christmas-tree' },
      { name: 'Boxing Day', date: '12-26', icon: 'fluent-emoji-flat:wrapped-gift' },
    ],
  },
  {
    id: 'japan',
    category: 'public',
    title: 'Japan national holidays',
    description: 'National holidays including the "Happy Monday" rules.',
    icon: 'twemoji:flag-japan',
    tags: ['japan', 'nihon', 'shukujitsu'],
    notes: 'Equinox days are approximated (they are announced annually). Substitute holidays are not applied.',
    entries: [
      { name: "New Year's Day", date: '01-01', icon: 'fluent-emoji-flat:sunrise' },
      { name: 'Coming of Age Day', date: '01W2-1', icon: 'fluent-emoji-flat:kimono' },
      { name: 'National Foundation Day', date: '02-11', icon: 'twemoji:flag-japan' },
      { name: "Emperor's Birthday", date: '02-23', icon: 'fluent-emoji-flat:crown' },
      { name: 'Vernal Equinox Day', date: '03-20', icon: 'fluent-emoji-flat:cherry-blossom' },
      { name: 'Shōwa Day', date: '04-29', icon: 'fluent-emoji-flat:books' },
      { name: 'Constitution Memorial Day', date: '05-03', icon: 'fluent-emoji-flat:scroll' },
      { name: 'Greenery Day', date: '05-04', icon: 'fluent-emoji-flat:deciduous-tree' },
      { name: "Children's Day", date: '05-05', icon: 'fluent-emoji-flat:carp-streamer' },
      { name: 'Marine Day', date: '07W3-1', icon: 'fluent-emoji-flat:water-wave' },
      { name: 'Mountain Day', date: '08-11', icon: 'fluent-emoji-flat:mountain' },
      { name: 'Respect for the Aged Day', date: '09W3-1', icon: 'fluent-emoji-flat:old-woman' },
      { name: 'Autumnal Equinox Day', date: '09-23', icon: 'fluent-emoji-flat:maple-leaf' },
      { name: 'Sports Day', date: '10W2-1', icon: 'fluent-emoji-flat:person-running' },
      { name: 'Culture Day', date: '11-03', icon: 'fluent-emoji-flat:artist-palette' },
      { name: 'Labor Thanksgiving Day', date: '11-23', icon: 'fluent-emoji-flat:handshake' },
    ],
  },

  // ─── Cultural & religious (non-Gregorian calendars) ───
  {
    id: 'chinese-traditional',
    category: 'cultural',
    title: 'Chinese traditional festivals',
    description: 'Lunisolar festivals computed with the Chinese calendar.',
    icon: 'fluent-emoji-flat:red-envelope',
    tags: ['china', 'lunar', 'spring festival', 'mid-autumn', 'chinese new year'],
    notes: "Chinese New Year's Eve (last day of the 12th month) cannot be expressed.",
    entries: [
      { name: 'Chinese New Year', date: '01-01[u-ca=chinese]', icon: 'fluent-emoji-flat:red-envelope' },
      { name: 'Lantern Festival', date: '01-15[u-ca=chinese]', icon: 'fluent-emoji-flat:red-paper-lantern' },
      { name: 'Dragon Boat Festival', date: '05-05[u-ca=chinese]', icon: 'fluent-emoji-flat:dragon' },
      { name: 'Qixi Festival', date: '07-07[u-ca=chinese]', icon: 'fluent-emoji-flat:milky-way' },
      { name: 'Mid-Autumn Festival', date: '08-15[u-ca=chinese]', icon: 'fluent-emoji-flat:moon-viewing-ceremony' },
      { name: 'Double Ninth Festival', date: '09-09[u-ca=chinese]', icon: 'fluent-emoji-flat:mountain' },
      { name: 'Laba Festival', date: '12-08[u-ca=chinese]', icon: 'fluent-emoji-flat:bowl-with-spoon' },
    ],
  },
  {
    id: 'korean-traditional',
    category: 'cultural',
    title: 'Korean traditional holidays',
    description: 'Lunar holidays computed with the Korean (Dangi) calendar.',
    icon: 'twemoji:flag-south-korea',
    tags: ['korea', 'lunar', 'seollal', 'chuseok'],
    entries: [
      { name: 'Seollal', date: '01-01[u-ca=dangi]', icon: 'twemoji:flag-south-korea' },
      { name: "Buddha's Birthday", date: '04-08[u-ca=dangi]', icon: 'fluent-emoji-flat:lotus' },
      { name: 'Chuseok', date: '08-15[u-ca=dangi]', icon: 'fluent-emoji-flat:full-moon' },
    ],
  },
  {
    id: 'jewish',
    category: 'cultural',
    title: 'Jewish holidays',
    description: 'First day of major holidays, computed with the Hebrew calendar.',
    icon: 'fluent-emoji-flat:menorah',
    tags: ['jewish', 'hebrew', 'judaism'],
    notes: 'Dates are the first full day; holidays begin at sundown the evening before.',
    entries: [
      { name: 'Rosh Hashanah', date: '01-01[u-ca=hebrew]', icon: 'fluent-emoji-flat:red-apple' },
      { name: 'Yom Kippur', date: '01-10[u-ca=hebrew]', icon: 'fluent-emoji-flat:candle' },
      { name: 'Sukkot', date: '01-15[u-ca=hebrew]', icon: 'fluent-emoji-flat:palm-tree' },
      { name: 'Hanukkah', date: '03-25[u-ca=hebrew]', icon: 'fluent-emoji-flat:menorah' },
      { name: 'Tu BiShvat', date: '05-15[u-ca=hebrew]', icon: 'fluent-emoji-flat:seedling' },
      { name: 'Purim', date: '06-14[u-ca=hebrew]', icon: 'fluent-emoji-flat:performing-arts' },
      { name: 'Passover', date: '07-15[u-ca=hebrew]', icon: 'fluent-emoji-flat:wine-glass' },
      { name: 'Shavuot', date: '09-06[u-ca=hebrew]', icon: 'fluent-emoji-flat:scroll' },
    ],
  },
  {
    id: 'islamic',
    category: 'cultural',
    title: 'Islamic holidays',
    description: 'Computed with the Umm al-Qura Islamic calendar.',
    icon: 'fluent-emoji-flat:mosque',
    tags: ['islam', 'muslim', 'hijri', 'ramadan', 'eid'],
    notes: 'Observed dates may differ by a day or two depending on moon sighting and region.',
    entries: [
      { name: 'Islamic New Year', date: '01-01[u-ca=islamic-umalqura]', icon: 'fluent-emoji-flat:crescent-moon' },
      { name: 'Ashura', date: '01-10[u-ca=islamic-umalqura]', icon: 'fluent-emoji-flat:mosque' },
      { name: 'Mawlid', date: '03-12[u-ca=islamic-umalqura]', icon: 'fluent-emoji-flat:star-and-crescent' },
      { name: 'Ramadan begins', date: '09-01[u-ca=islamic-umalqura]', icon: 'fluent-emoji-flat:crescent-moon' },
      { name: 'Eid al-Fitr', date: '10-01[u-ca=islamic-umalqura]', icon: 'fluent-emoji-flat:star-and-crescent' },
      { name: 'Eid al-Adha', date: '12-10[u-ca=islamic-umalqura]', icon: 'fluent-emoji-flat:kaaba' },
    ],
  },
  {
    id: 'persian',
    category: 'cultural',
    title: 'Persian celebrations',
    description: 'Computed with the Persian (Solar Hijri) calendar.',
    icon: 'twemoji:flag-iran',
    tags: ['persian', 'iran', 'nowruz', 'yalda'],
    entries: [
      { name: 'Nowruz', date: '01-01[u-ca=persian]', icon: 'fluent-emoji-flat:tulip' },
      { name: 'Sizdah Bedar', date: '01-13[u-ca=persian]', icon: 'fluent-emoji-flat:seedling' },
      { name: 'Yalda Night', date: '09-30[u-ca=persian]', icon: 'fluent-emoji-flat:watermelon' },
    ],
  },

  // ─── Celebrations ───
  {
    id: 'celebrations-common',
    category: 'celebrations',
    title: 'Common celebrations',
    description: "Valentine's, Mother's and Father's Day (US dates), Halloween, Christmas and New Year's Eve.",
    icon: 'fluent-emoji-flat:party-popper',
    tags: ['valentine', 'mother', 'father', 'halloween', 'christmas'],
    entries: [
      { name: "Valentine's Day", date: '02-14', icon: 'fluent-emoji-flat:heart-with-ribbon' },
      { name: "Mother's Day", date: '05W2-7', icon: 'fluent-emoji-flat:bouquet' },
      { name: "Father's Day", date: '06W3-7', icon: 'fluent-emoji-flat:necktie' },
      { name: 'Halloween', date: '10-31', icon: 'fluent-emoji-flat:jack-o-lantern' },
      { name: 'Christmas', date: '12-25', icon: 'fluent-emoji-flat:christmas-tree' },
      { name: "New Year's Eve", date: '12-31', icon: 'fluent-emoji-flat:fireworks' },
    ],
  },

  // ─── Clock & seasons ───
  {
    id: 'dst-us',
    category: 'clock',
    title: 'Daylight saving time (US & Canada)',
    description: 'Clocks spring forward on the 2nd Sunday of March and fall back on the 1st Sunday of November.',
    icon: 'fluent-emoji-flat:alarm-clock',
    tags: ['dst', 'clock change', 'time'],
    entries: [
      { name: 'Clocks spring forward', date: '03W2-7', icon: 'fluent-emoji-flat:alarm-clock' },
      { name: 'Clocks fall back', date: '11W1-7', icon: 'fluent-emoji-flat:mantelpiece-clock' },
    ],
  },
  {
    id: 'dst-eu',
    category: 'clock',
    title: 'Summer time (EU & UK)',
    description: 'Clocks change on the last Sunday of March and October.',
    icon: 'fluent-emoji-flat:alarm-clock',
    tags: ['dst', 'bst', 'cest', 'clock change', 'time'],
    entries: [
      { name: 'Summer time starts', date: '03Wn1-7', icon: 'fluent-emoji-flat:alarm-clock' },
      { name: 'Summer time ends', date: '10Wn1-7', icon: 'fluent-emoji-flat:mantelpiece-clock' },
    ],
  },
  {
    id: 'dst-au',
    category: 'clock',
    title: 'Daylight saving time (south-east Australia)',
    description: 'NSW, VIC, ACT, TAS and SA: ends 1st Sunday of April, starts 1st Sunday of October.',
    icon: 'fluent-emoji-flat:alarm-clock',
    tags: ['dst', 'australia', 'clock change'],
    entries: [
      { name: 'Daylight saving ends', date: '04W1-7', icon: 'fluent-emoji-flat:mantelpiece-clock' },
      { name: 'Daylight saving starts', date: '10W1-7', icon: 'fluent-emoji-flat:alarm-clock' },
    ],
  },
  {
    id: 'seasons-north',
    category: 'clock',
    title: 'Equinoxes & solstices',
    description: 'Start of astronomical seasons (northern hemisphere names).',
    icon: 'fluent-emoji-flat:sun-behind-cloud',
    tags: ['season', 'equinox', 'solstice', 'astronomy'],
    notes: 'Approximate: the actual instant can fall a day earlier or later depending on year and time zone.',
    entries: [
      { name: 'March equinox (spring)', date: '03-20', icon: 'fluent-emoji-flat:cherry-blossom' },
      { name: 'June solstice (summer)', date: '06-21', icon: 'fluent-emoji-flat:sun' },
      { name: 'September equinox (autumn)', date: '09-22', icon: 'fluent-emoji-flat:maple-leaf' },
      { name: 'December solstice (winter)', date: '12-21', icon: 'fluent-emoji-flat:snowflake' },
    ],
  },

  // ─── Personal (parameterized) ───
  {
    id: 'birthday',
    category: 'personal',
    title: 'Birthday',
    description: "Yearly countdown to someone's birthday.",
    icon: 'fluent-emoji-flat:birthday-cake',
    tags: ['birthday', 'family', 'friend'],
    params: [
      { key: 'who', label: 'Whose birthday', type: 'text', default: 'Alex' },
      { key: 'date', label: 'Date', type: 'monthday', default: '06-15' },
    ],
    entries: (p) => [{ name: `${p.who.trim() || 'Someone'}'s birthday`, date: p.date, icon: 'fluent-emoji-flat:birthday-cake' }],
  },
  {
    id: 'anniversary',
    category: 'personal',
    title: 'Anniversary',
    description: 'Yearly countdown to an anniversary.',
    icon: 'fluent-emoji-flat:ring',
    tags: ['wedding', 'anniversary', 'relationship'],
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Our anniversary' },
      { key: 'date', label: 'Date', type: 'monthday', default: '09-01' },
    ],
    entries: (p) => [{ name: p.title.trim() || 'Anniversary', date: p.date, icon: 'fluent-emoji-flat:ring' }],
  },
  {
    id: 'one-off-event',
    category: 'personal',
    title: 'One-time event',
    description: 'Count down to a single date: a trip, wedding, due date, launch, retirement…',
    icon: 'fluent-emoji-flat:spiral-calendar',
    tags: ['trip', 'vacation', 'wedding', 'launch', 'deadline', 'due date', 'retirement'],
    params: [
      { key: 'title', label: 'Event', type: 'text', default: 'Vacation' },
      { key: 'date', label: 'Date', type: 'date', default: '' },
      { key: 'icon', label: 'Icon', type: 'icon', default: 'fluent-emoji-flat:airplane' },
    ],
    entries: (p) => [{ name: p.title.trim() || 'Event', date: p.date, icon: p.icon || 'fluent-emoji-flat:spiral-calendar' }],
  },

  // ─── Money & admin ───
  {
    id: 'payday-day-of-month',
    category: 'money',
    title: 'Payday on a fixed day each month',
    description: 'One entry per month, optionally moved to the nearest weekday.',
    icon: 'fluent-emoji-flat:money-bag',
    tags: ['salary', 'paycheck', 'monthly'],
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Payday' },
      { key: 'day', label: 'Day of month', type: 'number', default: 15, min: 1, max: 28 },
      { key: 'weekdaysOnly', label: 'Move to nearest weekday', type: 'boolean', default: true },
    ],
    entries: (p) => months((m) => ({
      name: p.title.trim() || 'Payday',
      date: `${pad2(m)}-${pad2(p.day)}`,
      icon: 'fluent-emoji-flat:money-bag',
      ...(p.weekdaysOnly ? { round: WEEKDAYS } : {}),
    })),
  },
  {
    id: 'payday-multiple-days',
    category: 'money',
    title: 'Payday on several days each month',
    description: 'Semi-monthly or other fixed-day pay schedules, e.g. the 15th and the last day of every month.',
    icon: 'fluent-emoji-flat:money-with-wings',
    tags: ['salary', 'paycheck', 'semi-monthly', 'twice a month', 'bimonthly', 'monthly'],
    notes: 'Days past the end of a month use that month’s last day; February always uses the 28th.',
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Payday' },
      { key: 'days', label: 'Days of month', type: 'days', default: '15, last', help: 'Comma-separated days (1–31), or “last”.' },
      { key: 'weekdaysOnly', label: 'Move to nearest weekday', type: 'boolean', default: true },
    ],
    entries: (p) => months((m) => {
      const lastDay = m === 2 ? 28 : Temporal.PlainYearMonth.from({ year: 2025, month: m }).daysInMonth;
      const days = [...new Set((parseDayList(p.days) || []).map((d) => (d === 'last' ? lastDay : Math.min(d, lastDay))))].sort((a, b) => a - b);
      return days.map((d) => ({
        name: p.title.trim() || 'Payday',
        date: `${pad2(m)}-${pad2(d)}`,
        icon: 'fluent-emoji-flat:money-with-wings',
        ...(p.weekdaysOnly ? { round: WEEKDAYS } : {}),
      }));
    }).flat(),
  },
  {
    id: 'payday-last-weekday',
    category: 'money',
    title: 'Payday on the last given weekday',
    description: 'E.g. the last Friday of every month.',
    icon: 'fluent-emoji-flat:dollar-banknote',
    tags: ['salary', 'paycheck', 'monthly', 'friday'],
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Payday' },
      { key: 'weekday', label: 'Weekday', type: 'weekday', default: 5 },
    ],
    entries: (p) => months((m) => ({ name: p.title.trim() || 'Payday', date: `${pad2(m)}Wn1-${p.weekday}`, icon: 'fluent-emoji-flat:dollar-banknote' })),
  },
  {
    id: 'monthly-bill',
    category: 'money',
    title: 'Monthly bill due',
    description: 'Rent, mortgage, credit card or subscription due on the same day each month.',
    icon: 'fluent-emoji-flat:receipt',
    tags: ['rent', 'mortgage', 'credit card', 'bill', 'monthly'],
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Rent due' },
      { key: 'day', label: 'Day of month', type: 'number', default: 1, min: 1, max: 28 },
    ],
    entries: (p) => months((m) => ({ name: p.title.trim() || 'Bill due', date: `${pad2(m)}-${pad2(p.day)}`, icon: 'fluent-emoji-flat:receipt' })),
  },
  {
    id: 'us-tax',
    category: 'money',
    title: 'US tax deadlines',
    description: 'Federal income tax filing day and quarterly estimated tax payments.',
    icon: 'fluent-emoji-flat:classical-building',
    tags: ['irs', 'tax', 'estimated tax', 'usa'],
    notes: 'When a deadline falls on a weekend or holiday, the IRS moves it to the next business day; that adjustment is not applied.',
    entries: [
      { name: 'Q4 estimated tax due', date: '01-15', icon: 'fluent-emoji-flat:money-with-wings' },
      { name: 'Tax Day', date: '04-15', icon: 'fluent-emoji-flat:classical-building' },
      { name: 'Q2 estimated tax due', date: '06-15', icon: 'fluent-emoji-flat:money-with-wings' },
      { name: 'Q3 estimated tax due', date: '09-15', icon: 'fluent-emoji-flat:money-with-wings' },
    ],
  },

  // ─── Work & school ───
  {
    id: 'monthly-meeting',
    category: 'work',
    title: 'Monthly meeting',
    description: 'A recurring event on the n-th weekday of every month (e.g. first Monday).',
    icon: 'fluent-emoji-flat:busts-in-silhouette',
    tags: ['meeting', 'club', 'standup', 'monthly'],
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Team meeting' },
      { key: 'occurrence', label: 'Occurrence', type: 'occurrence', default: 1 },
      { key: 'weekday', label: 'Weekday', type: 'weekday', default: 1 },
    ],
    entries: (p) => months((m) => ({
      name: p.title.trim() || 'Meeting',
      date: p.occurrence > 0 ? `${pad2(m)}W${p.occurrence}-${p.weekday}` : `${pad2(m)}Wn1-${p.weekday}`,
      icon: 'fluent-emoji-flat:busts-in-silhouette',
    })),
  },
  {
    id: 'weekend',
    category: 'work',
    title: 'Countdown to the weekend',
    description: 'Every occurrence of a weekday (default Friday) all year round.',
    icon: 'fluent-emoji-flat:beach-with-umbrella',
    tags: ['weekend', 'friday', 'weekly', 'tgif'],
    notes: 'Weekly events are expanded into one entry per week of the month (up to 60 entries).',
    params: [
      { key: 'title', label: 'Title', type: 'text', default: 'Weekend' },
      { key: 'weekday', label: 'Weekday', type: 'weekday', default: 5 },
    ],
    entries: (p) => months((m) => [1, 2, 3, 4, 5].map((n) => ({
      name: p.title.trim() || 'Weekend',
      date: `${pad2(m)}W${n}-${p.weekday}`,
      icon: 'fluent-emoji-flat:beach-with-umbrella',
    }))).flat(),
  },
  {
    id: 'school-term',
    category: 'work',
    title: 'School term / semester',
    description: 'Countdown to the first and last day of a term.',
    icon: 'fluent-emoji-flat:school',
    tags: ['school', 'semester', 'term', 'university', 'vacation'],
    params: [
      { key: 'title', label: 'Term name', type: 'text', default: 'Fall semester' },
      { key: 'start', label: 'First day', type: 'date', default: '' },
      { key: 'end', label: 'Last day', type: 'date', default: '' },
    ],
    entries: (p) => [
      { name: `${p.title.trim() || 'Term'} starts`, date: p.start, icon: 'fluent-emoji-flat:school' },
      { name: `${p.title.trim() || 'Term'} ends`, date: p.end, icon: 'fluent-emoji-flat:graduation-cap' },
    ],
  },

  // ─── Fun & geeky ───
  {
    id: 'geek-days',
    category: 'fun',
    title: 'Geek days',
    description: 'Pi Day, Star Wars Day, Towel Day, Programmers’ Day and friends.',
    icon: 'fluent-emoji-flat:robot',
    tags: ['nerd', 'pi', 'star wars', 'programmer', 'y2038'],
    notes: "Programmers' Day is the 256th day of the year: September 13 (September 12 in leap years).",
    entries: [
      { name: 'Pi Day', date: '03-14', icon: 'fluent-emoji-flat:pie' },
      { name: 'Star Wars Day', date: '05-04', icon: 'fluent-emoji-flat:milky-way' },
      { name: 'Towel Day', date: '05-25', icon: 'fluent-emoji-flat:roll-of-paper' },
      { name: "Programmers' Day", date: '09-13', icon: 'fluent-emoji-flat:laptop' },
      { name: 'Talk Like a Pirate Day', date: '09-19', icon: 'fluent-emoji-flat:pirate-flag' },
      { name: 'Year 2038 problem', date: '2038-01-19', icon: 'mdi:cpu-32-bit' },
    ],
  },
];

export const MONTH_OPTIONS = MONTH_LABELS.map((label, i) => ({ value: i + 1, label }));

export function defaultParams(template) {
  const values = {};
  for (const p of template.params || []) values[p.key] = p.default;
  return values;
}

/** Validate parameter values; returns { key: message }. */
export function paramErrors(template, values) {
  const errors = {};
  for (const p of template.params || []) {
    const v = values[p.key];
    if (p.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v || '')) errors[p.key] = 'Pick a date';
    if (p.type === 'monthday' && !/^\d{2}-\d{2}$/.test(v || '')) errors[p.key] = 'Pick a month and day';
    if (p.type === 'days' && !parseDayList(v)) errors[p.key] = 'Enter days from 1 to 31 or “last”, separated by commas';
    if (p.type === 'number') {
      const n = Number(v);
      if (!Number.isInteger(n) || (p.min != null && n < p.min) || (p.max != null && n > p.max)) {
        errors[p.key] = `Enter a whole number${p.min != null ? ` from ${p.min}` : ''}${p.max != null ? ` to ${p.max}` : ''}`;
      }
    }
  }
  return errors;
}

/**
 * Materialize a template into plain entries ({ name, date, icon, round? }).
 * `today` lets date-generating templates skip past dates.
 */
export function buildTemplateEntries(template, values = defaultParams(template), { today = Temporal.Now.plainDateISO() } = {}) {
  const raw = typeof template.entries === 'function' ? template.entries(values, { today }) : template.entries;
  return raw.map((e) => {
    const out = { name: e.name, date: e.date, icon: e.icon };
    if (e.round && e.round.length) out.round = [...e.round];
    return out;
  });
}

export function searchTemplates(query, category) {
  const q = (query || '').trim().toLowerCase();
  return TEMPLATES.filter((t) => {
    if (category && t.category !== category) return false;
    if (!q) return true;
    const haystack = [t.title, t.description, ...(t.tags || [])].join(' ').toLowerCase();
    return q.split(/\s+/).every((part) => haystack.includes(part));
  });
}
