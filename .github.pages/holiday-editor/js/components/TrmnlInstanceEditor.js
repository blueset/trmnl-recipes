// Edit one TRMNL plugin instance: holidays list, number of holidays, instance name.

import { HolidayEditor } from './HolidayEditor.js';
import { CloneDialog } from './CloneDialog.js';
import { ModalDialog, confirmDialog } from './dialogs.js';
import {
  makeHoliday, reviveHoliday, toPlain, toPlainList, dumpYaml, serializeList, holidayErrors,
  parseHolidaysYaml, yamlHasComments,
} from '../holiday-model.js';
import { readInstance, writeInstance, updatePluginSetting, listPluginSettings, ApiError } from '../trmnl-api.js';
import { store, updateInstanceName } from '../store.js';
import { addGuard, navigate } from '../router.js';

const { ref, reactive, computed, watch, onMounted, onBeforeUnmount } = Vue;

const MANUAL_DRAFT_KEY = 'trmnl-holiday-editor';
const stashKey = (id) => `trmnl-holiday-editor:stash:${id}`;
const UNPARSED = '\u0000unparsed';

const numberValue = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

function describeFieldErrors(fe) {
  const list = Array.isArray(fe) ? fe : Object.entries(fe || {}).map(([path, message]) => ({ path, message }));
  return list.map((f) => {
    if (typeof f === 'string') return f;
    const where = String(f.path || f.field || '').replace(/^\/values\//, '');
    const msg = Array.isArray(f.message || f.messages) ? (f.message || f.messages).join(', ') : (f.message || f.messages || f.error || JSON.stringify(f));
    return where ? `${where}: ${msg}` : msg;
  });
}

export const TrmnlInstanceEditor = {
  name: 'TrmnlInstanceEditor',
  components: { HolidayEditor, CloneDialog, ModalDialog },
  props: { id: { type: String, required: true } },
  setup(props, { expose }) {
    const editor = ref(null);
    const holidays = reactive([]);
    const form = reactive({ name: '', number: '' });
    const baseline = reactive({ list: '', number: null, name: '', raw: '' });
    const state = reactive({
      loading: true, loadError: '', loadCode: '', parseError: '', instance: null,
      saving: false, status: '', statusKind: '', fieldErrors: [],
      commentsAcknowledged: false, stash: null, showClone: false, showConflict: false,
    });

    const instanceMeta = computed(() => store.instances.find((i) => i.id === props.id) || null);
    const installed = computed(() => instanceMeta.value?.installed ?? null);
    const hasComments = computed(() => yamlHasComments(baseline.raw));
    const errorCount = computed(() => holidays.filter((h) => holidayErrors(h).length).length);
    const numberError = computed(() => {
      const n = numberValue(form.number);
      return n === null || !Number.isInteger(n) || n < 1 ? 'Enter a whole number of at least 1.' : '';
    });
    const nameError = computed(() => (form.name.trim() ? '' : 'Name is required.'));

    const dirtyParts = computed(() => ({
      list: !state.loading && !state.loadError && !state.parseError && serializeList(holidays) !== baseline.list,
      number: !state.loading && !state.loadError && numberValue(form.number) !== baseline.number,
      name: !state.loading && !state.loadError && form.name.trim() !== baseline.name,
    }));
    const dirty = computed(() => dirtyParts.value.list || dirtyParts.value.number || dirtyParts.value.name);
    const canSave = computed(() => dirty.value && !state.saving
      && !errorCount.value && !numberError.value && !nameError.value);

    const manualDraft = computed(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(MANUAL_DRAFT_KEY) || '[]');
        return Array.isArray(saved) ? saved.map((s) => toPlain(reviveHoliday(s))) : [];
      } catch {
        return [];
      }
    });

    function setStatus(message, kind = '') {
      state.status = message;
      state.statusKind = kind;
    }

    // ─── Load ───
    function applyList(raw) {
      state.parseError = '';
      let items = [];
      if (Array.isArray(raw)) items = raw;
      else {
        const parsed = parseHolidaysYaml(raw);
        if (parsed.error) {
          state.parseError = parsed.error;
          holidays.splice(0, holidays.length);
          baseline.list = UNPARSED;
          return;
        }
        items = parsed.items;
      }
      holidays.splice(0, holidays.length, ...items.map((i) => makeHoliday(i)));
      baseline.list = serializeList(holidays);
    }

    async function resolveName(id) {
      if (instanceMeta.value) return instanceMeta.value.name;
      try {
        const ps = (await listPluginSettings()).find((p) => String(p.id) === id);
        return ps?.name || `#${id}`;
      } catch {
        return `#${id}`;
      }
    }

    async function load() {
      Object.assign(state, { loading: true, loadError: '', loadCode: '', fieldErrors: [], stash: null });
      setStatus('');
      try {
        const [inst, name] = await Promise.all([readInstance(props.id), resolveName(props.id)]);
        state.instance = inst;
        baseline.raw = Array.isArray(inst.values.list) ? dumpYaml(inst.values.list) : String(inst.values.list ?? '');
        applyList(inst.values.list);
        baseline.number = numberValue(inst.values.number);
        baseline.name = name;
        form.number = baseline.number ?? '';
        form.name = name;
        state.commentsAcknowledged = false;
        restoreStashOffer();
      } catch (e) {
        state.loadError = e.code === 'unsupported' ? 'This plugin is not a Custom Next Holiday instance.'
          : e.code === 'forbidden' ? "This sign-in wasn't granted access to this plugin."
          : e.code === 'not_found' ? 'Plugin not found in your account.'
          : e.message;
        state.loadCode = e.code || 'error';
      } finally {
        state.loading = false;
      }
    }

    // ─── Unsaved edits stash (survives reloads / re-sign-in within this tab) ───
    function writeStash() {
      try {
        if (!dirty.value) { sessionStorage.removeItem(stashKey(props.id)); return; }
        sessionStorage.setItem(stashKey(props.id), JSON.stringify({
          list: state.parseError ? null : toPlainList(holidays),
          listDirty: dirtyParts.value.list, number: form.number, name: form.name, savedAt: Date.now(),
        }));
      } catch {}
    }
    const clearStash = () => { try { sessionStorage.removeItem(stashKey(props.id)); } catch {} };
    function restoreStashOffer() {
      try {
        const s = JSON.parse(sessionStorage.getItem(stashKey(props.id)) || 'null');
        state.stash = s && (s.listDirty || String(s.number) !== String(form.number) || s.name !== form.name) ? s : null;
      } catch {
        state.stash = null;
      }
    }
    function restoreStash() {
      const s = state.stash;
      if (!s) return;
      if (s.listDirty && Array.isArray(s.list)) {
        state.parseError = '';
        holidays.splice(0, holidays.length, ...s.list.map((i) => makeHoliday(i)));
      }
      form.number = s.number;
      form.name = s.name;
      state.stash = null;
    }
    function discardStash() { state.stash = null; clearStash(); }

    let stashTimer = null;
    watch([() => serializeList(holidays), () => form.number, () => form.name], () => {
      // Keep the previous stash until the user restores or discards it.
      if (state.loading || state.stash) return;
      clearTimeout(stashTimer);
      stashTimer = setTimeout(writeStash, 400);
    });

    // ─── Save ───
    function buildChanges() {
      const changes = {};
      if (dirtyParts.value.list) changes.list = dumpYaml(toPlainList(holidays));
      if (dirtyParts.value.number) changes.number = numberValue(form.number);
      return changes;
    }

    async function save({ overwrite = false } = {}) {
      if (!overwrite && !canSave.value) return;
      if (dirtyParts.value.list && hasComments.value && !state.commentsAcknowledged) {
        const ok = await confirmDialog({
          title: 'Comments will be removed',
          message: 'The holidays YAML on TRMNL contains comments or custom formatting. Saving from the editor rewrites it in a standard format and removes comments.',
          confirmLabel: 'Save anyway',
        });
        if (!ok) return;
        state.commentsAcknowledged = true;
      }
      state.saving = true;
      state.fieldErrors = [];
      setStatus('Saving…');
      const changes = buildChanges();
      const listSnapshot = serializeList(holidays);
      const renameTo = dirtyParts.value.name ? form.name.trim() : null;
      try {
        let inst = state.instance;
        let warnings = [];
        if (overwrite) inst = await readInstance(props.id);
        if (Object.keys(changes).length) {
          inst = await writeInstance(inst, changes);
          warnings = inst.warnings || [];
          state.instance = inst;
          if (changes.list !== undefined) {
            baseline.raw = changes.list;
            baseline.list = listSnapshot;
          }
          if (changes.number !== undefined) baseline.number = changes.number;
        }
        if (renameTo) {
          await updatePluginSetting(props.id, { name: renameTo });
          baseline.name = renameTo;
          updateInstanceName(props.id, renameTo);
        }
        clearStash();
        if (warnings.length) setStatus(`Saved at ${new Date().toLocaleTimeString('en-GB', { hourCycle: 'h23' })}, with warnings: ${warnings.join('; ')}`, 'warn');
        else setStatus(`Saved at ${new Date().toLocaleTimeString('en-GB', { hourCycle: 'h23' })}`, 'ok');
      } catch (e) {
        if (e instanceof ApiError && e.code === 'conflict') {
          setStatus('This plugin was changed elsewhere since you opened it.', 'error');
          state.showConflict = true;
        } else if (e instanceof ApiError && e.code === 'invalid') {
          state.fieldErrors = describeFieldErrors(e.fieldErrors);
          setStatus(`TRMNL rejected the change: ${e.message}`, 'error');
        } else {
          setStatus(`Save failed: ${e.message}`, 'error');
        }
      } finally {
        state.saving = false;
      }
    }

    async function conflictReload() {
      state.showConflict = false;
      clearStash();
      await load();
    }
    async function conflictOverwrite() {
      state.showConflict = false;
      await save({ overwrite: true });
    }

    async function revert() {
      const ok = await confirmDialog({
        title: 'Discard unsaved changes?',
        message: 'The editor goes back to the version last loaded from or saved to TRMNL.',
        confirmLabel: 'Discard changes',
        danger: true,
      });
      if (!ok) return;
      applyList(baseline.raw);
      form.number = baseline.number ?? '';
      form.name = baseline.name;
      clearStash();
      setStatus('');
    }

    function confirmDiscard() {
      return confirmDialog({
        title: 'Leave with unsaved changes?',
        message: `Your changes to "${baseline.name}" have not been saved to TRMNL.`,
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
        danger: true,
      });
    }

    // ─── Parse-error recovery ───
    function startEmpty() {
      state.parseError = '';
      holidays.splice(0, holidays.length);
    }
    function fixRawYaml() {
      state.parseError = '';
      Vue.nextTick(() => editor.value?.openLoad());
    }
    function replaceWithTemplate() {
      state.parseError = '';
      Vue.nextTick(() => editor.value?.openTemplates('start'));
    }

    function importManualDraft() {
      editor.value?.replaceAll(manualDraft.value, { confirmTitle: 'Replace with your manual draft?' });
    }

    // ─── Guards ───
    let removeGuard = null;
    let discarded = false;
    function onBeforeUnload(e) {
      if (!dirty.value) return;
      writeStash();
      e.preventDefault();
      e.returnValue = '';
    }
    onMounted(() => {
      load();
      removeGuard = addGuard(async (to) => {
        if (to.name === 'trmnl' && to.params.id === props.id) return true;
        if (!dirty.value) return true;
        const ok = await confirmDiscard();
        if (ok) { discarded = true; clearStash(); }
        return ok;
      });
      window.addEventListener('beforeunload', onBeforeUnload);
    });
    onBeforeUnmount(() => {
      removeGuard?.();
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearTimeout(stashTimer);
      if (!discarded && !state.stash) writeStash();
    });

    watch(() => props.id, () => load());

    // Session restored after expiry: reload if the first load failed for auth reasons.
    watch(() => store.session, (s) => {
      if (s && ['signed_out', 'unauthorized', 'expired'].includes(state.loadCode)) load();
    });

    expose({ isDirty: () => dirty.value, confirmDiscard, markDiscarded: () => { discarded = true; clearStash(); } });

    return {
      editor, holidays, form, baseline, state, installed, hasComments, errorCount, numberError, nameError,
      dirty, dirtyParts, canSave, manualDraft, store,
      load, save, revert, conflictReload, conflictOverwrite, restoreStash, discardStash,
      startEmpty, fixRawYaml, replaceWithTemplate, importManualDraft,
      cloneYaml: computed(() => dumpYaml(toPlainList(holidays))),
      back: () => navigate('#trmnl'),
    };
  },
  template: `
    <section class="instance-editor">
      <nav class="breadcrumb"><a href="#trmnl">← All plugins</a></nav>

      <div v-if="state.loading" class="loading-state" aria-busy="true">Loading plugin #{{ id }}…</div>

      <div v-else-if="state.loadError" class="empty-state">
        <p class="field-error" role="alert">{{ state.loadError }}</p>
        <div class="actions">
          <button type="button" class="secondary" @click="load">Try again</button>
          <a href="#trmnl" role="button" class="secondary outline">Back to plugin list</a>
        </div>
      </div>

      <template v-else>
        <div class="instance-header">
          <div class="instance-fields">
            <label>
              Plugin name
              <input type="text" v-model="form.name" :aria-invalid="nameError ? 'true' : undefined">
              <small v-if="nameError" class="field-error">{{ nameError }}</small>
            </label>
            <label>
              Number of holidays shown
              <input type="number" min="1" step="1" v-model="form.number" :aria-invalid="numberError ? 'true' : undefined">
              <small v-if="numberError" class="field-error">{{ numberError }}</small>
            </label>
          </div>
          <div class="instance-links">
            <small class="muted">#{{ id }}</small>
            <span v-if="installed === true" class="badge" title="Installed from a recipe">installed</span>
            <span v-else-if="installed === false" class="badge" title="Your own copy of the plugin">forked</span>
            <a :href="'https://trmnl.com/plugin_settings/' + id + '/edit'" target="_blank" rel="noopener"><small>Open on TRMNL ↗</small></a>
          </div>
        </div>

        <div class="save-bar" :class="{ dirty }" role="status">
          <span class="save-state">
            <template v-if="state.saving">Saving…</template>
            <template v-else-if="dirty">● Unsaved changes</template>
            <template v-else-if="state.status">{{ state.status }}</template>
            <template v-else>All changes saved</template>
          </span>
          <span v-if="state.status && state.statusKind === 'error' && !state.saving" class="field-error">{{ state.status }}</span>
          <span class="spacer"></span>
          <button type="button" class="secondary outline" :disabled="!dirty || state.saving" @click="revert">Revert</button>
          <button type="button" :disabled="!canSave" :aria-busy="state.saving ? 'true' : undefined" @click="save()">Save to TRMNL</button>
        </div>
        <ul v-if="state.fieldErrors.length" class="field-error-list">
          <li v-for="(f, i) in state.fieldErrors" :key="i" class="field-error">{{ f }}</li>
        </ul>
        <p v-if="errorCount" class="notice">Fix {{ errorCount }} holiday{{ errorCount === 1 ? '' : 's' }} with missing or invalid fields before saving.</p>

        <div v-if="state.stash" class="notice stash-notice">
          You have unsaved edits to this plugin from earlier in this tab.
          <button type="button" class="secondary" @click="restoreStash">Restore them</button>
          <button type="button" class="secondary outline" @click="discardStash">Discard</button>
        </div>

        <div v-if="state.parseError" class="parse-error">
          <p class="field-error" role="alert">The holidays setting on TRMNL couldn't be read: {{ state.parseError }}</p>
          <pre class="raw-yaml">{{ baseline.raw }}</pre>
          <div class="actions">
            <button type="button" @click="fixRawYaml">Fix the YAML</button>
            <button type="button" class="secondary" @click="replaceWithTemplate">Replace with a template</button>
            <button type="button" class="secondary outline" @click="startEmpty">Start an empty list</button>
          </div>
        </div>

        <holiday-editor v-else ref="editor" :holidays="holidays"
          yaml-hint="This is what will be saved to the plugin's Holidays setting.">
          <template #toolbar-end>
            <button v-if="manualDraft.length" type="button" class="secondary outline" @click="importManualDraft"
              :title="'Replace with the ' + manualDraft.length + ' holidays from the manual editor'">Import manual draft</button>
            <button type="button" class="secondary outline" :disabled="errorCount > 0 || !holidays.length" @click="state.showClone = true">Copy to other plugins…</button>
          </template>
          <template #before-list>
            <p v-if="hasComments && dirtyParts.list" class="notice"><small>The original YAML has comments; saving rewrites it without them.</small></p>
          </template>
        </holiday-editor>

        <clone-dialog :open="state.showClone" :source-id="id" :source-name="form.name" :yaml="cloneYaml"
          :count="holidays.length" :unsaved="dirtyParts.list" @close="state.showClone = false"></clone-dialog>

        <modal-dialog :open="state.showConflict" title="This plugin changed on TRMNL" @close="state.showConflict = false">
          <p>Someone (maybe you, in another tab or on trmnl.com) saved this plugin after you opened it.</p>
          <ul class="confirm-details">
            <li><strong>Reload</strong> discards your edits and loads the latest version.</li>
            <li><strong>Overwrite</strong> replaces the latest version with what's in your editor.</li>
          </ul>
          <template #actions>
            <button type="button" class="secondary" @click="state.showConflict = false">Cancel</button>
            <button type="button" class="secondary" @click="conflictReload">Reload</button>
            <button type="button" class="danger" @click="conflictOverwrite">Overwrite</button>
          </template>
        </modal-dialog>
      </template>
    </section>`,
};
