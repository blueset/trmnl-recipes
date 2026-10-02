// Shared holiday list editor used by both the manual and the TRMNL entry points.
// Mutates the `holidays` array prop in place.

import { HolidayCard, CUSTOM_MONTH_SELECTS_SUPPORTED } from './HolidayCard.js';
import { IconPicker } from './IconPicker.js';
import { TemplateDialog } from './TemplateDialog.js';
import { LoadYamlDialog } from './LoadYamlDialog.js';
import { ModalDialog, confirmDialog } from './dialogs.js';
import {
  DEFAULT_ICON, makeHoliday, composeDateStr, holidayErrors, toPlainList, dumpYaml,
  normalizeMonth, canDuplicateAcrossMonths, monthDuplicationCount, buildMonthDuplicates,
} from '../holiday-model.js';
import { DOW_FULL, DISJUNCT_LIST_FORMATTER, getCalendars, calendarName, ordinal } from '../calendar-utils.js';

const { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } = Vue;

function describeDuplicateDate(h, count) {
  if (h._dateType === 'absolute') {
    const calendarLabel = h._useCal ? calendarName(h._calendar) + ' ' : '';
    return `Creates ${count} entries across all ${calendarLabel}months in year ${h._year}, each on day ${h._day}.`;
  }
  if (h._dateType === 'monthly') return `Creates 12 entries, one for each month on day ${h._day}.`;
  if (h._dateType === 'nthWeekday') return `Creates 12 entries, one for each month on the ${ordinal(h._occurrence)} ${DOW_FULL[h._weekday - 1]}.`;
  return `Creates 12 entries, one for each month on the ${h._occurrence === 1 ? '' : ordinal(h._occurrence) + ' '}last ${DOW_FULL[h._weekday - 1]}.`;
}

function describeDuplicateRounding(h) {
  if (!h.round || h.round.length === 0) return '';
  const weekdays = [...h.round].sort((a, b) => a - b).map((d) => DOW_FULL[d - 1]);
  return `Rounding to the nearest ${DISJUNCT_LIST_FORMATTER.format(weekdays)}.`;
}

export const HolidayEditor = {
  name: 'HolidayEditor',
  components: { HolidayCard, IconPicker, TemplateDialog, LoadYamlDialog, ModalDialog },
  props: {
    holidays: { type: Array, required: true },
    // Hint shown in the YAML panel (e.g. where to paste it).
    yamlHint: { type: String, default: '' },
  },
  emits: ['replaced'],
  setup(props, { emit, expose }) {
    const today = Temporal.Now.plainDateISO();
    const calendars = getCalendars();
    const list = () => props.holidays;

    const showYaml = ref(false);
    const showLoad = ref(false);
    const copyLabel = ref('Copy');
    const templateDialog = reactive({ open: false, mode: 'add' });
    const iconTarget = ref(null);
    const duplicateDialog = reactive({ open: false, target: null, count: 0, name: '', icon: '', description: '', rounding: '' });

    const plainList = computed(() => toPlainList(list()));
    const generatedYaml = computed(() => dumpYaml(plainList.value));
    const errorCount = computed(() => list().filter((h) => holidayErrors(h).length > 0).length);

    // ─── Month picker layout (custom base-select only) ───
    function updateMonthPickerLayouts() {
      if (!CUSTOM_MONTH_SELECTS_SUPPORTED) return;
      nextTick(() => {
        const gap = parseFloat(getComputedStyle(document.documentElement).fontSize || '16') * 0.5;
        for (const select of document.querySelectorAll('select.month-select')) {
          const container = select.closest('.month-field') || select.parentElement;
          const containerWidth = container?.clientWidth || select.clientWidth || 0;
          const minSize = Math.max(56, Math.floor((Math.max(containerWidth, 0) - gap * 5) / 4));
          select.style.setProperty('--month-picker-min-size', `${minSize}px`);
        }
      });
    }

    // Keep h.date in sync with the composer fields.
    watch(() => props.holidays, () => {
      for (const h of list()) {
        if (h._dateInvalid) continue;
        normalizeMonth(h, today);
        const d = composeDateStr(h);
        if (d && d !== h.date) h.date = d;
      }
      updateMonthPickerLayouts();
    }, { deep: true, immediate: true });

    onMounted(() => {
      updateMonthPickerLayouts();
      if (CUSTOM_MONTH_SELECTS_SUPPORTED) window.addEventListener('resize', updateMonthPickerLayouts);
    });
    onBeforeUnmount(() => window.removeEventListener('resize', updateMonthPickerLayouts));

    function openAndScrollTo(id) {
      nextTick(() => {
        const el = document.querySelector(`details.holiday-card[data-id="${id}"]`);
        if (el) {
          el.open = true;
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // ─── CRUD ───
    function addHoliday() {
      const h = makeHoliday();
      list().push(h);
      openAndScrollTo(h._id);
    }
    function remove(idx) { list().splice(idx, 1); }
    function move(idx, dir) {
      const target = idx + dir;
      const arr = list();
      if (target < 0 || target >= arr.length) return;
      arr.splice(idx, 1, ...arr.splice(target, 1, arr[idx]));
    }

    async function replaceAll(entries, { confirmTitle = 'Replace current holidays?' } = {}) {
      if (list().length) {
        const ok = await confirmDialog({
          title: confirmTitle,
          message: `This replaces all ${list().length} current holiday${list().length === 1 ? '' : 's'} with ${entries.length} new entr${entries.length === 1 ? 'y' : 'ies'}.`,
          confirmLabel: 'Replace',
          danger: true,
        });
        if (!ok) return false;
      }
      const items = entries.map((e) => makeHoliday(e));
      list().splice(0, list().length, ...items);
      if (items.length) openAndScrollTo(items[0]._id);
      emit('replaced');
      return true;
    }

    // ─── Load YAML ───
    async function onLoad(items) {
      if (await replaceAll(items)) showLoad.value = false;
    }

    // ─── Templates ───
    function openTemplates(mode) {
      templateDialog.mode = mode || (list().length ? 'add' : 'start');
      templateDialog.open = true;
    }
    async function onTemplateApply(entries) {
      if (templateDialog.mode === 'start') {
        if (await replaceAll(entries)) templateDialog.open = false;
        return;
      }
      const items = entries.map((e) => makeHoliday(e));
      list().push(...items);
      templateDialog.open = false;
      if (items.length) openAndScrollTo(items[0]._id);
    }

    // ─── Icon picker ───
    function onIconSelected(name) {
      if (iconTarget.value) iconTarget.value.icon = name;
      iconTarget.value = null;
    }

    // ─── Repeat for all months ───
    function openDuplicateDialog(h) {
      if (!canDuplicateAcrossMonths(h)) return;
      const count = monthDuplicationCount(h, today);
      Object.assign(duplicateDialog, {
        open: true, target: h, count, name: h.name, icon: h.icon,
        description: describeDuplicateDate(h, count), rounding: describeDuplicateRounding(h),
      });
    }
    function closeDuplicateDialog() {
      Object.assign(duplicateDialog, { open: false, target: null, count: 0, name: '', icon: '', description: '', rounding: '' });
    }
    function confirmDuplicateDialog() {
      const h = duplicateDialog.target;
      const idx = list().indexOf(h);
      if (idx < 0 || !canDuplicateAcrossMonths(h)) return closeDuplicateDialog();
      const duplicates = buildMonthDuplicates(h, today);
      list().splice(idx, 1, ...duplicates);
      closeDuplicateDialog();
      if (duplicates.length) openAndScrollTo(duplicates[0]._id);
    }

    async function copyYaml() {
      try {
        await navigator.clipboard.writeText(generatedYaml.value);
        copyLabel.value = 'Copied!';
      } catch {
        copyLabel.value = 'Failed';
      }
      setTimeout(() => { copyLabel.value = 'Copy'; }, 2000);
    }

    expose({ addHoliday, openTemplates, openLoad: () => { showLoad.value = true; }, openAndScrollTo, replaceAll });

    return {
      DEFAULT_ICON, today, calendars, showYaml, showLoad, copyLabel, templateDialog, iconTarget, duplicateDialog,
      plainList, generatedYaml, errorCount, updateMonthPickerLayouts,
      addHoliday, remove, move, onLoad, openTemplates, onTemplateApply, onIconSelected,
      openDuplicateDialog, closeDuplicateDialog, confirmDuplicateDialog, copyYaml,
    };
  },
  template: `
    <div class="holiday-editor">
      <div class="toolbar">
        <slot name="toolbar-start"></slot>
        <button type="button" @click="addHoliday">+ Add Holiday</button>
        <button type="button" class="secondary" @click="openTemplates()">Templates…</button>
        <button type="button" class="secondary" @click="showLoad = true">Load YAML</button>
        <button type="button" class="secondary yaml-toggle" @click="showYaml = !showYaml">{{ showYaml ? 'Hide' : 'Show' }} YAML</button>
        <slot name="toolbar-end"></slot>
      </div>

      <div class="editor-layout">
        <div class="editor-main">
          <slot name="before-list"></slot>
          <div v-if="holidays.length === 0" class="empty-state">
            <slot name="empty">
              <p>No holidays yet.</p>
              <div class="actions">
                <button type="button" @click="addHoliday">+ Add Holiday</button>
                <button type="button" class="secondary" @click="openTemplates('start')">Start from a template</button>
              </div>
            </slot>
          </div>
          <holiday-card v-for="(h, idx) in holidays" :key="h._id"
            :holiday="h" :index="idx" :count="holidays.length" :today="today" :calendars="calendars"
            @move="move(idx, $event)" @remove="remove(idx)" @pick-icon="iconTarget = h"
            @repeat="openDuplicateDialog(h)" @toggle="updateMonthPickerLayouts"></holiday-card>
        </div>

        <aside class="editor-sidebar" :class="{ 'show-narrow': showYaml }">
          <div v-if="errorCount" class="yaml-warning">⚠ {{ errorCount }} holiday{{ errorCount === 1 ? ' has' : 's have' }} missing or invalid fields (name, icon, or date). Fix them before copying or saving.</div>
          <p v-if="yamlHint" class="yaml-hint">{{ yamlHint }}</p>
          <div class="yaml-output">
            <pre>{{ generatedYaml }}</pre>
            <button type="button" class="copy-btn secondary" @click="copyYaml" :disabled="errorCount > 0">{{ copyLabel }}</button>
          </div>
          <slot name="sidebar"></slot>
        </aside>
      </div>

      <load-yaml-dialog :open="showLoad" @load="onLoad" @close="showLoad = false">
        <p v-if="holidays.length" class="muted">Loading replaces the {{ holidays.length }} holiday{{ holidays.length === 1 ? '' : 's' }} currently in the editor.</p>
      </load-yaml-dialog>

      <template-dialog :open="templateDialog.open" :mode="templateDialog.mode" :existing="plainList"
        @apply="onTemplateApply" @close="templateDialog.open = false"></template-dialog>

      <icon-picker :open="!!iconTarget" @select="onIconSelected" @close="iconTarget = null"></icon-picker>

      <modal-dialog :open="duplicateDialog.open" title="Repeat Holiday for All Months" @close="closeDuplicateDialog">
        <p>Replace this holiday with {{ duplicateDialog.count }} month-specific entries based on the current item?</p>
        <div class="duplicate-preview">
          <div class="duplicate-preview-header">
            <iconify-icon :icon="duplicateDialog.icon || DEFAULT_ICON" width="24"></iconify-icon>
            <strong>{{ duplicateDialog.name || '(unnamed)' }}</strong>
          </div>
          <p class="duplicate-preview-description">{{ duplicateDialog.description }}</p>
          <p v-if="duplicateDialog.rounding" class="duplicate-preview-rounding">{{ duplicateDialog.rounding }}</p>
        </div>
        <template #actions>
          <button type="button" class="secondary" @click="closeDuplicateDialog">Cancel</button>
          <button type="button" @click="confirmDuplicateDialog">Duplicate</button>
        </template>
      </modal-dialog>
    </div>`,
};
