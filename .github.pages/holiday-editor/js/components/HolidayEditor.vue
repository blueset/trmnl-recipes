<script setup>
import { ref, reactive, computed, watch, nextTick, useId } from 'vue';
import HolidayCard from './HolidayCard.vue';
import IconPicker from './IconPicker.vue';
import TemplateDialog from './TemplateDialog.vue';
import LoadYamlDialog from './LoadYamlDialog.vue';
import { ModalDialog, confirmDialog } from './dialogs.js';
import { DEFAULT_ICON, makeHoliday, composeDateStr, holidayErrors, toPlainList, dumpYaml, normalizeMonth, canDuplicateAcrossMonths, monthDuplicationCount, buildMonthDuplicates } from '../holiday-model.js';
import { getCalendars, DOW_FULL, DISJUNCT_LIST_FORMATTER } from '../calendar-utils.js';
import { describeHoliday, nextOccurrence, displayDate } from '../holiday-summary.js';

const props = defineProps({ holidays: { type: Array, required: true }, yamlHint: { type: String, default: '' } });
const emit = defineEmits(['replaced']);
const today = Temporal.Now.plainDateISO();
const calendars = getCalendars();
const id = useId();
const query = ref('');
const selectedId = ref(null);
const mobileDetail = ref(false);
const detail = ref(null);
const listElement = ref(null);
const actionMenu = ref(null);
const showYaml = ref(false);
const showLoad = ref(false);
const loadInitialText = ref('');
const copyState = ref('');
const copyError = ref('');
const showErrors = ref(false);
const undo = ref(null);
const templateDialog = reactive({ open: false, mode: 'add' });
const iconTarget = ref(null);
const duplicateTarget = ref(null);
const selected = computed(() => props.holidays.find(h => h._id === selectedId.value) || null);
const selectedIndex = computed(() => props.holidays.indexOf(selected.value));
const plainList = computed(() => toPlainList(props.holidays));
const generatedYaml = computed(() => dumpYaml(plainList.value));
const errorCount = computed(() => props.holidays.filter(h => holidayErrors(h).length).length);
const filtered = computed(() => props.holidays.filter(h => `${h.name} ${describeHoliday(h)} ${h.date}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const duplicateCount = computed(() => duplicateTarget.value ? monthDuplicationCount(duplicateTarget.value, today) : 0);
const duplicateRounding = computed(() => duplicateTarget.value?.round.length ? DISJUNCT_LIST_FORMATTER.format([...duplicateTarget.value.round].sort((a,b) => a-b).map(d => DOW_FULL[d - 1])) : '');
function closeActions() {
  actionMenu.value.open = false;
}

watch(() => props.holidays, () => {
  for (const h of props.holidays) {
    if (h._dateInvalid) continue;
    normalizeMonth(h, today);
    const date = composeDateStr(h);
    if (date && date !== h.date) h.date = date;
  }
  if (!selected.value) {
    selectedId.value = props.holidays[0]?._id ?? null;
    if (!props.holidays.length) mobileDetail.value = false;
  }
}, { deep: true, immediate: true });

function select(h) { selectedId.value = h._id; mobileDetail.value = true; nextTick(() => detail.value?.focusHeading()); }
function back() {
  mobileDetail.value = false;
  nextTick(() => listElement.value?.querySelector(`[data-holiday-id="${selectedId.value}"]`)?.focus());
}
function openAndScrollTo(holidayId) {
  query.value = '';
  selectedId.value = holidayId;
  mobileDetail.value = true;
  nextTick(() => detail.value?.focusName());
}
function addHoliday() { const h = makeHoliday(); props.holidays.push(h); openAndScrollTo(h._id); }
function remove() {
  const index = selectedIndex.value;
  if (index < 0) return;
  undo.value = { holiday: selected.value, index };
  props.holidays.splice(index, 1);
  selectedId.value = props.holidays[Math.min(index, props.holidays.length - 1)]?._id ?? null;
  back();
}
function restoreDeleted() {
  if (!undo.value) return;
  const { holiday, index } = undo.value;
  props.holidays.splice(Math.min(index, props.holidays.length), 0, holiday);
  undo.value = null;
  openAndScrollTo(holiday._id);
}
function move(direction) {
  const index = selectedIndex.value;
  const target = index + direction;
  if (index < 0 || target < 0 || target >= props.holidays.length) return;
  const [h] = props.holidays.splice(index, 1);
  props.holidays.splice(target, 0, h);
}
async function replaceAll(entries, { confirmTitle = 'Replace current holidays?' } = {}) {
  if (props.holidays.length && !await confirmDialog({ title: confirmTitle, message: `Replace all ${props.holidays.length} holidays with ${entries.length} new entries?`, confirmLabel: 'Replace holidays', danger: true })) return false;
  const items = entries.map(makeHoliday);
  undo.value = null;
  props.holidays.splice(0, props.holidays.length, ...items);
  if (items.length) openAndScrollTo(items[0]._id);
  emit('replaced');
  return true;
}
async function onLoad(items) { if (await replaceAll(items)) showLoad.value = false; }
function openTemplates(mode) { templateDialog.mode = mode || (props.holidays.length ? 'add' : 'start'); templateDialog.open = true; }
async function applyTemplate(entries) {
  if (templateDialog.mode === 'start') { if (await replaceAll(entries)) templateDialog.open = false; return; }
  const items = entries.map(makeHoliday);
  props.holidays.push(...items);
  templateDialog.open = false;
  if (items.length) openAndScrollTo(items[0]._id);
}
function pickIcon(name) { if (iconTarget.value) iconTarget.value.icon = name; iconTarget.value = null; }
function repeat() {
  const h = duplicateTarget.value;
  const index = props.holidays.indexOf(h);
  if (index < 0 || !canDuplicateAcrossMonths(h)) { duplicateTarget.value = null; return; }
  const duplicates = buildMonthDuplicates(h, today);
  props.holidays.splice(index, 1, ...duplicates);
  undo.value = null;
  duplicateTarget.value = null;
  if (duplicates.length) openAndScrollTo(duplicates[0]._id);
}
async function copyYaml() {
  copyError.value = '';
  if (errorCount.value) { showErrors.value = true; showYaml.value = true; return; }
  try {
    await navigator.clipboard.writeText(generatedYaml.value);
    copyState.value = 'YAML copied';
  } catch (error) {
    copyState.value = '';
    copyError.value = 'Clipboard access failed. Select the YAML below and copy it manually.';
    console.warn('Could not copy holiday YAML.', error);
    showYaml.value = true;
  }
}
watch(generatedYaml, () => { copyState.value = ''; copyError.value = ''; });
defineExpose({ addHoliday, openTemplates, openLoad: (text = '') => { loadInitialText.value = text; showLoad.value = true; }, openAndScrollTo, replaceAll });
</script>
<template>
  <div class="holiday-editor">
    <div class="workspace-toolbar">
      <div class="toolbar-group"><button type="button" aria-label="Add holiday" @click="addHoliday">+ <span class="desktop-label">Add holiday</span><span class="mobile-label">Add</span></button><button type="button" class="secondary" @click="openTemplates()">Templates</button></div>
      <div class="toolbar-group"><button type="button" class="secondary" :aria-label="copyState ? 'Copied' : 'Copy YAML'" @click="copyYaml"><span class="desktop-label">{{ copyState ? 'Copied' : 'Copy YAML' }}</span><span class="mobile-label">{{ copyState ? 'Copied' : 'Copy' }}</span></button><details ref="actionMenu" class="action-menu"><summary><span class="desktop-label">More actions</span><span class="mobile-label">More</span></summary><div class="action-menu-content" @click="closeActions"><button type="button" class="quiet" @click="loadInitialText = ''; showLoad = true">Import YAML</button><button type="button" class="quiet" @click="showYaml = true">View YAML</button><slot name="toolbar-start"/><slot name="toolbar-end"/></div></details></div>
    </div>
    <div v-if="undo" class="undo-notice" role="status"><span>Deleted {{ undo.holiday.name || 'unnamed holiday' }}.</span><button type="button" class="quiet" @click="restoreDeleted">Undo deletion</button></div>
    <p v-if="copyState" class="inline-status" role="status">{{ copyState }}. {{ yamlHint }}</p>
    <p v-if="errorCount" class="validation-summary">{{ errorCount }} holiday{{ errorCount === 1 ? ' needs' : 's need' }} attention before copying or saving.</p>
    <slot name="before-list"/>
    <div class="workspace" :class="{ 'show-detail': mobileDetail && selected }">
      <section class="holiday-list-panel" aria-label="Holiday list">
        <div class="list-heading"><h2>Your holidays <span class="count">{{ holidays.length }}</span></h2><label :for="id + '-search'" class="sr-only">Search holidays</label><input :id="id + '-search'" type="search" v-model="query" placeholder="Search holidays"></div>
        <p v-if="query" class="search-note">Filtering keeps your original order. Move actions use the full list. <button type="button" class="text-button" @click="query = ''">Clear search</button></p>
        <ul ref="listElement" class="holiday-list"><li v-for="h in filtered" :key="h._id"><button type="button" class="holiday-row" :class="{ selected: selectedId === h._id }" :data-holiday-id="h._id" :aria-current="selectedId === h._id ? 'true' : undefined" @click="select(h)"><iconify-icon :icon="h.icon || DEFAULT_ICON" width="28" aria-hidden="true"/><span class="holiday-row-text"><strong>{{ h.name || 'New holiday' }}</strong><span>{{ describeHoliday(h) }}</span><small v-if="holidayErrors(h).length" class="error-text">Needs attention</small><small v-else-if="nextOccurrence(h, today)">{{ nextOccurrence(h, today).days === 0 ? 'Today' : 'Next: ' + displayDate(nextOccurrence(h, today).iso) }}</small><small v-else>No upcoming date</small></span><span aria-hidden="true" class="row-chevron">&rsaquo;</span></button></li></ul>
        <div v-if="!filtered.length" class="empty-state"><template v-if="holidays.length"><h3>No matches</h3><p>Try a different name or clear your search.</p><button type="button" class="secondary" @click="query = ''">Show all holidays</button></template><template v-else><h3>Your next important date starts here</h3><p>Add a holiday or choose a ready-made template.</p><button type="button" @click="addHoliday">Add a holiday</button><button type="button" class="secondary" @click="openTemplates('start')">Browse templates</button></template></div>
      </section>
      <holiday-card v-if="selected" ref="detail" :holiday="selected" :index="selectedIndex" :count="holidays.length" :today="today" :calendars="calendars" :show-errors="showErrors" @back="back" @move="move" @remove="remove" @pick-icon="iconTarget = selected" @repeat="duplicateTarget = selected"/>
      <div v-else class="detail-placeholder"><h2>A list that feels like you</h2><p>Birthdays, festivals, paydays, and anything worth looking forward to.</p></div>
    </div>
    <modal-dialog :open="showYaml" title="Your holidays as YAML" wide @close="showYaml = false"><p class="help-text">{{ yamlHint }}</p><p v-if="errorCount" class="notice error-notice" role="alert">Fix {{ errorCount }} incomplete or unrecognized holidays before copying.</p><p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p><label :for="id + '-yaml'" class="sr-only">Generated holiday YAML</label><textarea :id="id + '-yaml'" class="yaml-textarea yaml-export" readonly :value="generatedYaml" spellcheck="false"/><slot name="sidebar"/><template #actions><button type="button" class="secondary" @click="showYaml = false">Close</button><button type="button" :disabled="!!errorCount" @click="copyYaml">{{ copyState || 'Copy YAML' }}</button></template></modal-dialog>
    <load-yaml-dialog :open="showLoad" :initial-text="loadInitialText" @load="onLoad" @close="showLoad = false"><p v-if="holidays.length" class="help-text">Importing replaces your current {{ holidays.length }} holidays. You will be asked to confirm.</p></load-yaml-dialog>
    <template-dialog :open="templateDialog.open" :mode="templateDialog.mode" :existing="plainList" @apply="applyTemplate" @close="templateDialog.open = false"/>
    <icon-picker :open="!!iconTarget" @select="pickIcon" @close="iconTarget = null"/>
    <modal-dialog :open="!!duplicateTarget" title="Repeat for all months" @close="duplicateTarget = null"><template v-if="duplicateTarget"><p>Replace <strong>{{ duplicateTarget.name || 'this holiday' }}</strong> with {{ duplicateCount }} month-specific entries?</p><p class="help-text">{{ describeHoliday(duplicateTarget) }}. The date rule, name, and icon will be kept for each month.</p><p v-if="duplicateRounding" class="help-text">Adjust each date to the nearest {{ duplicateRounding }}.</p></template><template #actions><button type="button" class="secondary" @click="duplicateTarget = null">Cancel</button><button type="button" @click="repeat">Create {{ duplicateCount }} entries</button></template></modal-dialog>
  </div>
</template>
