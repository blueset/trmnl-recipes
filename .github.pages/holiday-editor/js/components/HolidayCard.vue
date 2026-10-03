<script setup>
import { computed, ref, watch, useId, nextTick } from 'vue';
import { DEFAULT_ICON, composeDateStr, holidayErrors, calendarMonthCount, canDuplicateAcrossMonths } from '../holiday-model.js';
import { upcomingOccurrences } from '../date-core.js';
import { DOW_FULL, GREGORIAN_MONTH_OPTIONS, getCalendarMonthOptions, calendarName, ordinal } from '../calendar-utils.js';
import { describeHoliday, displayDate } from '../holiday-summary.js';

const props = defineProps({ holiday: { type: Object, required: true }, index: Number, count: Number, today: Object, calendars: Array, showErrors: Boolean });
const emit = defineEmits(['move', 'remove', 'pick-icon', 'repeat', 'back']);
const id = useId();
const nameInput = ref(null);
const heading = ref(null);
const iconSection = ref(null);
const iconInput = ref(null);
const iconSectionOpen = ref(false);
const touched = ref(false);
const h = computed(() => props.holiday);
watch(() => props.holiday._id, () => { touched.value = false; });
const errors = computed(() => holidayErrors(h.value));
const revealErrors = computed(() => touched.value || props.showErrors);
const nameInvalid = computed(() => revealErrors.value && !h.value.name.trim());
const iconInvalid = computed(() => revealErrors.value && !h.value.icon.trim());
const dateInvalid = computed(() => h.value._dateInvalid || (revealErrors.value && !composeDateStr(h.value)));
const upcoming = computed(() => upcomingOccurrences(composeDateStr(h.value), h.value.round, props.today, 5));
const months = computed(() => {
  if (!h.value._useCal) return GREGORIAN_MONTH_OPTIONS;
  if (h.value._dateType !== 'absolute') return Array.from({ length: calendarMonthCount(h.value, props.today) }, (_, index) => ({ value: index + 1, label: `Month ${index + 1}` }));
  return getCalendarMonthOptions(Number(h.value._year) || props.today.withCalendar(h.value._calendar).year, h.value._calendar);
});
const dateTypes = [
  { value: 'absolute', label: 'One-time date', hint: 'A date in a specific year' },
  { value: 'monthly', label: 'Every year', hint: 'The same month and day' },
  { value: 'nthWeekday', label: 'Weekday in a month', hint: 'For example, the second Friday' },
  { value: 'lastNthWeekday', label: 'Weekday from the end', hint: 'For example, the last Monday' },
];
function touchDate() { h.value._dateInvalid = false; touched.value = true; }
function dateFieldInvalid(key) { return revealErrors.value && !h.value[key] ? 'true' : undefined; }
async function focusIcon() {
  iconSection.value.open = true;
  await nextTick();
  iconInput.value.focus();
  iconInput.value.scrollIntoView({ block: 'center' });
}
defineExpose({ focusName: () => nameInput.value?.focus(), focusHeading: () => heading.value?.focus() });
</script>
<template>
  <section class="holiday-detail" :aria-labelledby="id + '-title'">
    <div class="detail-heading">
      <button type="button" class="quiet mobile-back" @click="emit('back')"><span aria-hidden="true">&larr;</span> Back to holidays</button>
      <div class="detail-title-row"><div><p class="eyebrow">Holiday {{ index + 1 }} of {{ count }}</p><h2 :id="id + '-title'" ref="heading" tabindex="-1">{{ h.name || 'New holiday' }}</h2></div><button type="button" class="icon-button quiet" aria-label="Edit holiday icon" :aria-controls="id + '-icon-section'" :aria-expanded="iconSectionOpen" @click="focusIcon"><iconify-icon :icon="h.icon || DEFAULT_ICON" width="36" aria-hidden="true"/></button></div>
    </div>
    <div class="detail-form">
      <div class="field"><label :for="id + '-name'">Holiday name</label><input :id="id + '-name'" ref="nameInput" v-model="h.name" placeholder="e.g. Mum’s birthday" @blur="touched = true" :aria-invalid="nameInvalid ? 'true' : undefined" :aria-describedby="nameInvalid ? id + '-name-error' : undefined"><small v-if="nameInvalid" :id="id + '-name-error'" class="field-error">Give this holiday a name.</small></div>
      <fieldset class="date-composer" :aria-invalid="dateInvalid ? 'true' : undefined" :aria-describedby="dateInvalid ? id + '-date-error' : undefined" @input="touchDate" @change="touchDate">
        <legend>When does it happen?</legend>
        <p v-if="h._dateInvalid" :id="id + '-date-error'" class="field-error">Unrecognized date <code>{{ h.date }}</code>. It stays unchanged until you edit the date controls.</p>
        <p v-else-if="dateInvalid" :id="id + '-date-error'" class="field-error">Complete the date fields to define this holiday.</p>
        <div class="date-options">
          <label v-for="type in dateTypes" :key="type.value" :class="{ selected: h._dateType === type.value }"><input class="sr-only" type="radio" :name="id + '-date-type'" :value="type.value" v-model="h._dateType"><span>{{ type.label }}<small>{{ type.hint }}</small></span></label>
        </div>
        <div class="date-fields">
          <div v-if="h._dateType === 'absolute'" class="field"><label :for="id + '-year'">Year</label><input :id="id + '-year'" type="number" min="2000" max="2100" v-model.number="h._year" :aria-invalid="dateFieldInvalid('_year')" :aria-describedby="dateFieldInvalid('_year') ? id + '-date-error' : undefined"></div>
          <div class="field month-field"><label :for="id + '-month'">Month</label><select :id="id + '-month'" v-model.number="h._month" :aria-invalid="dateFieldInvalid('_month')" :aria-describedby="dateFieldInvalid('_month') ? id + '-date-error' : undefined"><option v-for="month in months" :key="month.value" :value="month.value">{{ month.label }}</option></select></div>
          <div v-if="['absolute', 'monthly'].includes(h._dateType)" class="field"><label :for="id + '-day'">Day</label><input :id="id + '-day'" type="number" min="1" max="31" v-model.number="h._day" :aria-invalid="dateFieldInvalid('_day')" :aria-describedby="dateFieldInvalid('_day') ? id + '-date-error' : undefined"></div>
          <template v-else>
            <div class="field"><label :for="id + '-occurrence'">{{ h._dateType === 'lastNthWeekday' ? 'From the end' : 'Occurrence' }}</label><select :id="id + '-occurrence'" v-model.number="h._occurrence" :aria-invalid="dateFieldInvalid('_occurrence')" :aria-describedby="dateFieldInvalid('_occurrence') ? id + '-date-error' : undefined"><option v-for="n in 5" :key="n" :value="n">{{ h._dateType === 'lastNthWeekday' ? (n === 1 ? 'Last' : ordinal(n) + '-to-last') : ordinal(n) }}</option></select></div>
            <div class="field"><label :for="id + '-weekday'">Weekday</label><select :id="id + '-weekday'" v-model.number="h._weekday" :aria-invalid="dateFieldInvalid('_weekday')" :aria-describedby="dateFieldInvalid('_weekday') ? id + '-date-error' : undefined"><option v-for="(day, index) in DOW_FULL" :key="day" :value="index + 1">{{ day }}</option></select></div>
          </template>
        </div>
      </fieldset>
      <div class="rule-summary"><span class="eyebrow">Your date rule</span><p>{{ describeHoliday(h) }}</p><small v-if="h.round.length">Adjusted to the nearest selected weekday.</small></div>
      <details :id="id + '-icon-section'" ref="iconSection" class="settings-section" @toggle="iconSectionOpen = $event.target.open">
        <summary>Holiday icon <span class="summary-value" :class="{ 'invalid-summary': iconInvalid }">{{ iconInvalid ? 'Icon required' : (h.icon ? 'Selected' : 'Required') }}</span></summary>
        <label :for="id + '-icon'">Icon identifier</label>
        <div class="icon-input-row"><iconify-icon :icon="h.icon || DEFAULT_ICON" width="28" aria-hidden="true"/><input :id="id + '-icon'" ref="iconInput" v-model="h.icon" placeholder="e.g. fluent:calendar-20-regular" @blur="touched = true" :aria-invalid="iconInvalid ? 'true' : undefined" :aria-describedby="iconInvalid ? id + '-icon-error' : undefined"><button type="button" class="secondary" @click="emit('pick-icon')">Browse icons</button></div>
        <small v-if="iconInvalid" :id="id + '-icon-error'" class="field-error">Choose an icon or enter an Iconify identifier.</small>
      </details>
      <details class="settings-section" :open="h._useCal">
        <summary>Calendar <span class="summary-value">{{ h._useCal ? calendarName(h._calendar) : 'Gregorian' }}</span></summary>
        <label class="check-label"><input type="checkbox" v-model="h._useCal" @change="touchDate"> Use a different calendar</label>
        <div v-if="h._useCal" class="field"><label :for="id + '-calendar'">Calendar system</label><select :id="id + '-calendar'" v-model="h._calendar" @change="touchDate"><option v-for="calendar in calendars" :key="calendar" :value="calendar">{{ calendarName(calendar) }} ({{ calendar }})</option></select><small>Month and day numbers refer to this calendar, not the Gregorian calendar.</small></div>
      </details>
      <details class="settings-section">
        <summary>Weekday adjustment <span class="summary-value">{{ h.round.length ? h.round.map(day => DOW_FULL[day - 1].slice(0, 3)).join(', ') : 'None' }}</span></summary>
        <p class="help-text">Move to the nearest allowed weekday if the date falls on another day. This may move a date backwards or forwards.</p>
        <fieldset><legend class="sr-only">Allowed weekdays</legend><div class="round-chips"><label v-for="(day, index) in DOW_FULL" :key="day"><input class="sr-only" type="checkbox" :value="index + 1" v-model="h.round"><span>{{ day.slice(0, 3) }}</span></label></div></fieldset>
        <div class="preset-actions"><button type="button" class="quiet" @click="h.round = [1,2,3,4,5]">Weekdays</button><button type="button" class="quiet" @click="h.round = [6,7]">Weekends</button><button type="button" class="quiet" @click="h.round = []">Clear</button></div>
      </details>
      <section class="occurrences" aria-label="Upcoming occurrences"><h3>Upcoming dates</h3><ol v-if="upcoming.length"><li v-for="date in upcoming" :key="date.iso"><span>{{ displayDate(date.iso) }} <small>{{ DOW_FULL[date.date.dayOfWeek - 1] }}</small></span><span class="date-distance">{{ date.days === 0 ? 'Today' : 'In ' + date.days + ' days' }}</span></li></ol><p v-else class="help-text">{{ h._dateType === 'absolute' && !h._dateInvalid ? 'No upcoming date. This one-time date may have passed or cannot be resolved.' : 'No upcoming occurrences found. Check the date rule and calendar.' }}</p></section>
      <details class="settings-section"><summary>Date expression &amp; repetition <span v-if="dateInvalid" class="summary-value invalid-summary">Check date</span></summary><p class="help-text">The expression used by your TRMNL plugin:</p><code class="date-expression" :aria-invalid="dateInvalid ? 'true' : undefined">{{ composeDateStr(h) || 'No date yet' }}</code><button v-if="canDuplicateAcrossMonths(h)" type="button" class="secondary repeat-button" @click="emit('repeat')">Repeat for all months</button></details>
      <div v-if="showErrors && errors.length" class="notice error-notice" role="alert">{{ errors.join('. ') }}.</div>
      <div class="detail-bottom"><div class="reorder-actions"><button type="button" class="quiet" :disabled="index === 0" @click="emit('move', -1)">Move up</button><button type="button" class="quiet" :disabled="index === count - 1" @click="emit('move', 1)">Move down</button></div><button type="button" class="quiet danger-text" @click="emit('remove')">Delete holiday</button></div>
    </div>
  </section>
</template>
