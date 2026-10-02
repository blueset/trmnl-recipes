// Template gallery: browse, parameterize, preview and pick entries.

import { ModalDialog } from './dialogs.js';
import { IconPicker } from './IconPicker.js';
import {
  TEMPLATES, TEMPLATE_CATEGORIES, MONTH_OPTIONS,
  buildTemplateEntries, defaultParams, paramErrors, searchTemplates,
} from '../templates.js';
import { dedupeKey } from '../holiday-model.js';
import { upcomingOccurrences } from '../date-core.js';
import { DOW_FULL, ordinal } from '../calendar-utils.js';

const { ref, reactive, computed, watch } = Vue;

export const TemplateDialog = {
  name: 'TemplateDialog',
  components: { ModalDialog, IconPicker },
  props: {
    open: { type: Boolean, default: false },
    // 'start' replaces the current list; 'add' merges into it.
    mode: { type: String, default: 'add' },
    existing: { type: Array, default: () => [] },
  },
  emits: ['apply', 'close'],
  setup(props, { emit }) {
    const today = Temporal.Now.plainDateISO();
    const query = ref('');
    const category = ref('');
    const selectedId = ref(TEMPLATES[0].id);
    const params = reactive({});
    const checked = ref(new Set());
    const iconPickerOpen = ref(false);
    const iconParamKey = ref('');

    const filtered = computed(() => searchTemplates(query.value, category.value));
    const selected = computed(() => TEMPLATES.find((t) => t.id === selectedId.value) || null);
    const categoryTitle = (id) => TEMPLATE_CATEGORIES.find((c) => c.id === id)?.title || id;

    function resetParams() {
      for (const k of Object.keys(params)) delete params[k];
      if (selected.value) Object.assign(params, defaultParams(selected.value));
    }
    watch(selectedId, resetParams, { immediate: true });
    watch(() => props.open, (open) => {
      if (open) { query.value = ''; category.value = ''; resetParams(); }
    });
    watch(filtered, (list) => {
      if (list.length && !list.some((t) => t.id === selectedId.value)) selectedId.value = list[0].id;
    });

    const errors = computed(() => (selected.value ? paramErrors(selected.value, params) : {}));
    const hasParamErrors = computed(() => Object.keys(errors.value).length > 0);

    const existingKeys = computed(() => new Set(props.existing.map(dedupeKey)));
    const entries = computed(() => {
      if (!selected.value || hasParamErrors.value) return [];
      const seen = new Set();
      return buildTemplateEntries(selected.value, { ...params }).map((entry) => {
        const key = dedupeKey(entry);
        const duplicate = props.mode === 'add' && (existingKeys.value.has(key) || seen.has(key));
        seen.add(key);
        const next = upcomingOccurrences(entry.date, entry.round, today, 1)[0] || null;
        return { entry, key, duplicate, next };
      });
    });

    watch(entries, (list) => {
      checked.value = new Set(list.map((e, i) => (e.duplicate ? -1 : i)).filter((i) => i >= 0));
    }, { immediate: true });

    function toggle(i) {
      const s = new Set(checked.value);
      s.has(i) ? s.delete(i) : s.add(i);
      checked.value = s;
    }
    const setAll = (on) => {
      checked.value = on ? new Set(entries.value.map((_, i) => i)) : new Set();
    };
    const duplicateCount = computed(() => entries.value.filter((e) => e.duplicate).length);

    // monthday helpers ('MM-DD')
    const mdPart = (key, part) => Number(String(params[key] || '01-01').split('-')[part]) || 1;
    function setMd(key, part, value) {
      const parts = [mdPart(key, 0), mdPart(key, 1)];
      parts[part] = Number(value) || 1;
      params[key] = `${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
    }

    function openIconPicker(key) { iconParamKey.value = key; iconPickerOpen.value = true; }
    function onIconSelected(name) { params[iconParamKey.value] = name; iconPickerOpen.value = false; }

    function apply() {
      const picked = entries.value.filter((_, i) => checked.value.has(i)).map((e) => e.entry);
      if (picked.length) emit('apply', picked, selected.value);
    }

    const describeNext = (n) => (n ? (n.days === 0 ? 'Today' : `${n.iso} · in ${n.days} day${n.days === 1 ? '' : 's'}`) : 'No upcoming date');

    return {
      TEMPLATE_CATEGORIES, MONTH_OPTIONS, DOW_FULL, ordinal,
      query, category, selectedId, selected, filtered, categoryTitle, params, errors, hasParamErrors,
      entries, checked, toggle, setAll, duplicateCount, mdPart, setMd,
      iconPickerOpen, openIconPicker, onIconSelected, apply, describeNext,
      close: () => emit('close'),
    };
  },
  template: `
    <modal-dialog :open="open" :title="mode === 'start' ? 'Start from a template' : 'Add from a template'" wide @close="close">
      <div class="template-layout">
        <div class="template-browser">
          <input type="search" v-model="query" placeholder="Search templates (e.g. payday, lunar, DST)…">
          <div class="chip-row">
            <button type="button" class="chip" :class="{ active: !category }" @click="category = ''">All</button>
            <button v-for="c in TEMPLATE_CATEGORIES" :key="c.id" type="button" class="chip" :class="{ active: category === c.id }" @click="category = c.id">{{ c.title }}</button>
          </div>
          <ul class="template-list">
            <li v-for="t in filtered" :key="t.id">
              <button type="button" :class="{ active: t.id === selectedId }" @click="selectedId = t.id">
                <iconify-icon :icon="t.icon" width="24"></iconify-icon>
                <span>
                  <strong>{{ t.title }}</strong>
                  <small>{{ categoryTitle(t.category) }}</small>
                </span>
              </button>
            </li>
            <li v-if="!filtered.length" class="muted-center">No templates match.</li>
          </ul>
        </div>

        <div v-if="selected" class="template-detail">
          <h4><iconify-icon :icon="selected.icon" width="28"></iconify-icon> {{ selected.title }}</h4>
          <p>{{ selected.description }}</p>
          <p v-if="selected.notes" class="template-notes">Note: {{ selected.notes }}</p>

          <div v-if="selected.params && selected.params.length" class="template-params">
            <div v-for="p in selected.params" :key="p.key" class="template-param">
              <label v-if="p.type !== 'boolean'">{{ p.label }}</label>
              <input v-if="p.type === 'text'" type="text" v-model="params[p.key]">
              <input v-else-if="p.type === 'date'" type="date" v-model="params[p.key]" :aria-invalid="errors[p.key] ? 'true' : undefined">
              <input v-else-if="p.type === 'number'" type="number" v-model.number="params[p.key]" :min="p.min" :max="p.max" :aria-invalid="errors[p.key] ? 'true' : undefined">
              <input v-else-if="p.type === 'days'" type="text" inputmode="text" placeholder="1, 15, last" v-model="params[p.key]" :aria-invalid="errors[p.key] ? 'true' : undefined">
              <div v-else-if="p.type === 'monthday'" class="inline-fields">
                <select :value="mdPart(p.key, 0)" @change="setMd(p.key, 0, $event.target.value)">
                  <option v-for="m in MONTH_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
                <input type="number" min="1" max="31" :value="mdPart(p.key, 1)" @input="setMd(p.key, 1, $event.target.value)">
              </div>
              <select v-else-if="p.type === 'weekday'" v-model.number="params[p.key]">
                <option v-for="(d, i) in DOW_FULL" :key="i" :value="i + 1">{{ d }}</option>
              </select>
              <select v-else-if="p.type === 'occurrence'" v-model.number="params[p.key]">
                <option v-for="n in 4" :key="n" :value="n">{{ ordinal(n) }}</option>
                <option :value="-1">Last</option>
              </select>
              <label v-else-if="p.type === 'boolean'"><input type="checkbox" v-model="params[p.key]"> {{ p.label }}</label>
              <div v-else-if="p.type === 'icon'" class="inline-fields">
                <iconify-icon :icon="params[p.key] || 'fluent:calendar-20-regular'" width="28"></iconify-icon>
                <input type="text" v-model="params[p.key]">
                <button type="button" class="secondary" @click="openIconPicker(p.key)">Browse…</button>
              </div>
              <small v-if="p.help" class="muted">{{ p.help }}</small>
              <div v-if="errors[p.key]" class="field-error">{{ errors[p.key] }}</div>
            </div>
          </div>

          <div v-if="entries.length" class="template-entries">
            <div class="template-entries-header">
              <strong>{{ checked.size }} of {{ entries.length }} selected</strong>
              <span v-if="duplicateCount" class="muted">· {{ duplicateCount }} already in your list</span>
              <span class="spacer"></span>
              <button type="button" class="link-button" @click="setAll(true)">All</button>
              <button type="button" class="link-button" @click="setAll(false)">None</button>
            </div>
            <ul>
              <li v-for="(e, i) in entries" :key="i" :class="{ duplicate: e.duplicate }">
                <label>
                  <input type="checkbox" :checked="checked.has(i)" @change="toggle(i)">
                  <iconify-icon :icon="e.entry.icon" width="22"></iconify-icon>
                  <span class="entry-name">{{ e.entry.name }}</span>
                  <code>{{ e.entry.date }}</code>
                  <span v-if="e.duplicate" class="badge">duplicate</span>
                  <span class="entry-next muted">{{ describeNext(e.next) }}</span>
                </label>
              </li>
            </ul>
          </div>
          <p v-else-if="hasParamErrors" class="muted">Fill in the fields above to preview entries.</p>
        </div>
      </div>
      <template #actions>
        <button class="secondary" @click="close">Cancel</button>
        <button :disabled="checked.size === 0" @click="apply">
          {{ mode === 'start' ? 'Use' : 'Add' }} {{ checked.size }} entr{{ checked.size === 1 ? 'y' : 'ies' }}
        </button>
      </template>
    </modal-dialog>
    <icon-picker :open="iconPickerOpen" @select="onIconSelected" @close="iconPickerOpen = false"></icon-picker>`,
};
