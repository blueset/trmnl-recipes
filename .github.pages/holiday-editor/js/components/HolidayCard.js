// Single holiday card: name, icon, date composer, rounding, upcoming preview.

import {
  DATE_FORMATS, DEFAULT_ICON, composeDateStr, holidayErrors, calendarMonthCount, canDuplicateAcrossMonths,
} from '../holiday-model.js';
import { upcomingOccurrences } from '../date-core.js';
import {
  DOW_FULL, GREGORIAN_MONTH_OPTIONS, getCalendarMonthOptions, calendarName, ordinal, dowName,
} from '../calendar-utils.js';

export function supportsCustomMonthSelects() {
  if (!window.CSS?.supports) return false;
  try {
    return CSS.supports('appearance: base-select')
      && CSS.supports('selector(::picker(select))')
      && CSS.supports('selector(selectedcontent)');
  } catch {
    return false;
  }
}

export const CUSTOM_MONTH_SELECTS_SUPPORTED = supportsCustomMonthSelects();
document.documentElement.classList.toggle('supports-custom-month-selects', CUSTOM_MONTH_SELECTS_SUPPORTED);

export const MonthSelect = {
  name: 'MonthSelect',
  props: { modelValue: { type: Number, default: 1 }, options: { type: Array, required: true } },
  emits: ['update:modelValue'],
  template: `
    <select class="month-select" :value="modelValue" @change="$emit('update:modelValue', Number($event.target.value))">
      <button v-pre type="button"><selectedcontent></selectedcontent></button>
      <option v-for="option in options" :key="option.value" :value="option.value" class="month-option"
              :data-short-label="option.shortLabel">{{ option.value }} — {{ option.label }}</option>
    </select>`,
};

export const HolidayCard = {
  name: 'HolidayCard',
  components: { MonthSelect },
  props: {
    holiday: { type: Object, required: true },
    index: { type: Number, required: true },
    count: { type: Number, required: true },
    today: { type: Object, required: true },
    calendars: { type: Array, required: true },
  },
  emits: ['move', 'remove', 'pick-icon', 'repeat', 'toggle'],
  setup(props) {
    const h = () => props.holiday;
    return {
      DATE_FORMATS, DEFAULT_ICON, GREGORIAN_MONTH_OPTIONS,
      ordinal, dowName, calendarName, composeDateStr,
      errors: () => holidayErrors(h()),
      dateStr: () => composeDateStr(h()),
      monthCount: () => calendarMonthCount(h(), props.today),
      absoluteMonthOptions: () => {
        const x = h();
        if (!x._useCal || !x._calendar) return GREGORIAN_MONTH_OPTIONS;
        const year = Number(x._year) || props.today.withCalendar(x._calendar).year;
        return getCalendarMonthOptions(year, x._calendar);
      },
      upcoming: () => upcomingOccurrences(composeDateStr(h()), h().round, props.today, 5)
        .map((o) => ({ iso: o.iso, days: o.days, dow: DOW_FULL[o.date.dayOfWeek - 1] })),
      canRepeat: () => canDuplicateAcrossMonths(h()),
      // Any edit in the date composer replaces an unrecognized date string.
      touchDate: () => { h()._dateInvalid = false; },
    };
  },
  template: `
    <details name="holidays" class="holiday-card" :class="{ 'has-errors': errors().length }" :data-id="holiday._id" @toggle="$emit('toggle')">
      <summary>
        <span class="holiday-header">
          <iconify-icon :icon="holiday.icon || DEFAULT_ICON" width="24"></iconify-icon>
          <span class="holiday-name">{{ holiday.name || '(unnamed)' }}</span>
          <span v-if="holiday.date" class="holiday-date-badge">{{ holiday.date }}</span>
          <span v-if="errors().length" class="error-dot" :title="errors().join(', ')"></span>
          <span class="holiday-actions">
            <button type="button" title="Move up" :disabled="index === 0" @click.prevent="$emit('move', -1)">&#9650;</button>
            <button type="button" title="Move down" :disabled="index === count - 1" @click.prevent="$emit('move', 1)">&#9660;</button>
            <button type="button" title="Delete" @click.prevent="$emit('remove')">&#10005;</button>
          </span>
        </span>
      </summary>
      <div class="holiday-body">
        <fieldset>
          <legend>Name</legend>
          <input type="text" v-model="holiday.name" placeholder="Holiday name" :aria-invalid="!holiday.name.trim() || undefined">
          <div v-if="!holiday.name.trim()" class="field-error">Name is required.</div>
        </fieldset>

        <fieldset>
          <legend>Icon</legend>
          <div class="icon-input-row">
            <iconify-icon :icon="holiday.icon || DEFAULT_ICON" width="28"></iconify-icon>
            <input type="text" v-model="holiday.icon" placeholder="e.g. fluent-emoji-flat:fireworks" :aria-invalid="!holiday.icon.trim() || undefined">
            <button type="button" class="secondary" @click="$emit('pick-icon')">Browse…</button>
          </div>
          <div v-if="!holiday.icon.trim()" class="field-error">Icon is required.</div>
        </fieldset>

        <fieldset @input="touchDate" @change="touchDate">
          <legend>Date</legend>
          <div v-if="holiday._dateInvalid" class="field-error">
            Unrecognized date <code>{{ holiday.date }}</code> — it is kept as-is until you edit the fields below.
          </div>
          <div class="date-tabs">
            <label v-for="fmt in DATE_FORMATS" :key="fmt.value">
              <input type="radio" :value="fmt.value" v-model="holiday._dateType">
              <span>{{ fmt.label }}</span>
            </label>
          </div>

          <div v-if="holiday._dateType === 'absolute'" class="date-fields">
            <div><label>Year</label><input type="number" v-model.number="holiday._year" min="2000" max="2100"></div>
            <div class="month-field">
              <label>Month</label>
              <month-select v-model="holiday._month" :options="absoluteMonthOptions()"></month-select>
            </div>
            <div><label>Day</label><input type="number" v-model.number="holiday._day" min="1" max="31"></div>
          </div>

          <div v-else class="date-fields">
            <div class="month-field">
              <label>Month</label>
              <input v-if="holiday._useCal" type="number" v-model.number="holiday._month" min="1" :max="monthCount()">
              <month-select v-else v-model="holiday._month" :options="GREGORIAN_MONTH_OPTIONS"></month-select>
            </div>
            <div v-if="holiday._dateType === 'monthly'"><label>Day</label><input type="number" v-model.number="holiday._day" min="1" max="31"></div>
            <div v-if="holiday._dateType === 'nthWeekday'"><label>Occurrence</label>
              <select v-model.number="holiday._occurrence"><option v-for="n in 5" :key="n" :value="n">{{ ordinal(n) }}</option></select>
            </div>
            <div v-if="holiday._dateType === 'lastNthWeekday'"><label>From End</label>
              <select v-model.number="holiday._occurrence"><option v-for="n in 5" :key="n" :value="n">{{ n === 1 ? '' : ordinal(n) }} last</option></select>
            </div>
            <div v-if="holiday._dateType !== 'monthly'"><label>Weekday</label>
              <select v-model.number="holiday._weekday"><option v-for="d in 7" :key="d" :value="d">{{ dowName(d) }}</option></select>
            </div>
          </div>

          <div class="calendar-row">
            <label><input type="checkbox" v-model="holiday._useCal"> Use non-Gregorian calendar</label>
            <select v-if="holiday._useCal" v-model="holiday._calendar">
              <option v-for="c in calendars" :key="c" :value="c">{{ c }} — {{ calendarName(c) }}</option>
            </select>
          </div>

          <div v-if="dateStr()"><strong>Date string:</strong> <span class="date-preview">{{ dateStr() }}</span></div>
          <div v-else class="field-error">Date is required.</div>
        </fieldset>

        <fieldset>
          <legend>Round to Weekday <small class="muted">(optional)</small></legend>
          <div class="round-chips">
            <label v-for="d in 7" :key="d">
              <input type="checkbox" :value="d" v-model="holiday.round">
              <span>{{ dowName(d) }}</span>
            </label>
            <button type="button" class="outline secondary" @click="holiday.round = [1,2,3,4,5]">Weekdays</button>
            <button type="button" class="outline secondary" @click="holiday.round = [6,7]">Weekends</button>
            <button type="button" class="outline secondary" @click="holiday.round = []">Clear</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Upcoming Occurrences</legend>
          <ul v-if="upcoming().length" class="upcoming-list">
            <li v-for="d in upcoming()" :key="d.iso">
              {{ d.iso }} <span class="dow">{{ d.dow }}</span>{{ ' · ' }}<span v-if="d.days === 0" class="upcoming-today">Today!</span>
              <span v-else class="upcoming-days">in {{ d.days }} day{{ d.days === 1 ? '' : 's' }}</span>
            </li>
          </ul>
          <p v-else class="upcoming-none">No upcoming occurrences found.</p>
        </fieldset>

        <div v-if="canRepeat()" class="holiday-footer-actions">
          <button type="button" class="secondary" @click="$emit('repeat')">Repeat for all months</button>
        </div>
      </div>
    </details>`,
};
