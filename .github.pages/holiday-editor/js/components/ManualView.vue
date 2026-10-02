<script>
// "Edit YAML manually" entry point: paste/copy YAML, autosaved in this browser.

import HolidayEditor from './HolidayEditor.vue';
import TemplateDialog from './TemplateDialog.vue';
import LoadYamlDialog from './LoadYamlDialog.vue';
import { confirmDialog } from './dialogs.js';
import { makeHoliday, reviveHoliday } from '../holiday-model.js';

import { ref, reactive, watch, nextTick } from 'vue';

const STORAGE_KEY = 'trmnl-holiday-editor';

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) return { items: saved.map(reviveHoliday), error: '' };
    if (saved !== null) throw new Error('The saved draft is not a holiday list.');
    return { items: null, error: '' };
  } catch (error) {
    console.warn('Could not restore holiday draft.', error);
    return { items: null, error: 'Your saved draft could not be read. Its stored data has not been removed. Starting a new list will replace it.' };
  }
}

export default {
  name: 'ManualView',
  components: { HolidayEditor, TemplateDialog, LoadYamlDialog },
  setup() {
    const restored = restore();
    const holidays = reactive(restored.items || []);
    const started = ref(!!restored.items);
    const editor = ref(null);
    const showLoad = ref(false);
    const showTemplates = ref(false);
    const storageError = ref(restored.error);

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(holidays));
        storageError.value = '';
      } catch (error) {
        storageError.value = 'Your draft could not be saved in this browser. Copy the YAML before leaving.';
        console.warn('Could not save holiday draft.', error);
      }
    }

    watch(holidays, (val) => {
      if (!started.value) return;
      persist();
    }, { deep: true });

    function begin(items) {
      holidays.splice(0, holidays.length, ...items);
      started.value = true;
      persist();
      if (items.length) nextTick(() => editor.value?.openAndScrollTo(items[0]._id));
    }

    const startFresh = () => begin([makeHoliday()]);
    function onLoad(items) {
      showLoad.value = false;
      begin(items.map((i) => makeHoliday(i)));
    }
    function onTemplate(entries) {
      showTemplates.value = false;
      begin(entries.map((e) => makeHoliday(e)));
    }

    async function startOver() {
      const ok = await confirmDialog({
        title: 'Start over?',
        message: `This clears the ${holidays.length} holiday${holidays.length === 1 ? '' : 's'} saved in this browser. Copy the YAML first if you need it.`,
        confirmLabel: 'Clear and start over',
        danger: true,
      });
      if (!ok) return;
      try { localStorage.removeItem(STORAGE_KEY); }
      catch (error) {
        storageError.value = 'Your browser draft could not be cleared. Try again or copy your YAML first.';
        console.warn('Could not clear holiday draft.', error);
        return;
      }
      started.value = false;
      holidays.splice(0, holidays.length);
    }

    return { holidays, started, editor, showLoad, showTemplates, storageError, startFresh, onLoad, onTemplate, startOver };
  },
};
</script>
<template>

    <div class="manual-view">
      <div class="page-heading"><div><p class="eyebrow">Your own little calendar</p><h1>Local editor</h1><p>Create a list here, then copy the YAML into your TRMNL plugin's Holidays setting.</p></div><span v-if="started && !storageError" class="draft-status" role="status">Saved in this browser</span></div>
      <p v-if="storageError" class="notice error-notice" role="alert">{{ storageError }}</p>
      <section v-if="!started" class="start-panel">
        <h2>How would you like to start?</h2>
        <p>Build a holiday list here, then copy the YAML into the <strong>Holidays</strong> field of your plugin settings on TRMNL.
          Your work is saved automatically in this browser.</p>
        <div class="start-options">
          <button type="button" class="start-option" @click="startFresh">
            <iconify-icon icon="fluent:document-add-24-regular" width="32"></iconify-icon>
            <strong>Start fresh</strong>
            <small>Begin with one empty holiday.</small>
          </button>
          <button type="button" class="start-option" @click="showTemplates = true">
            <iconify-icon icon="fluent:apps-list-detail-24-regular" width="32"></iconify-icon>
            <strong>Start from a template</strong>
            <small>Public holidays, lunar festivals, paydays, birthdays…</small>
          </button>
          <button type="button" class="start-option" @click="showLoad = true">
            <iconify-icon icon="fluent:clipboard-paste-24-regular" width="32"></iconify-icon>
            <strong>Load existing YAML</strong>
            <small>Paste the Holidays setting from your plugin.</small>
          </button>
        </div>
        <load-yaml-dialog :open="showLoad" @load="onLoad" @close="showLoad = false"></load-yaml-dialog>
        <template-dialog :open="showTemplates" mode="start" :existing="[]" @apply="onTemplate" @close="showTemplates = false"></template-dialog>
      </section>

      <holiday-editor v-else ref="editor" :holidays="holidays"
        yaml-hint="Paste this into the Holidays field of your Custom Next Holiday plugin on TRMNL.">
        <template #toolbar-end>
          <a href="#trmnl" role="button" class="secondary outline" title="Sign in and save straight to your plugins">Edit on TRMNL instead</a>
          <button type="button" class="quiet danger-text" @click="startOver">Start over</button>
        </template>
      </holiday-editor>
    </div>
</template>
