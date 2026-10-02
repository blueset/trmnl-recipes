// "Edit YAML manually" entry point: paste/copy YAML, autosaved in this browser.

import { HolidayEditor } from './HolidayEditor.js';
import { TemplateDialog } from './TemplateDialog.js';
import { LoadYamlDialog } from './LoadYamlDialog.js';
import { confirmDialog } from './dialogs.js';
import { makeHoliday, reviveHoliday } from '../holiday-model.js';

const { ref, reactive, watch, nextTick } = Vue;

const STORAGE_KEY = 'trmnl-holiday-editor';

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved.map(reviveHoliday);
  } catch {}
  return null;
}

export const ManualView = {
  name: 'ManualView',
  components: { HolidayEditor, TemplateDialog, LoadYamlDialog },
  setup() {
    const restored = restore();
    const holidays = reactive(restored || []);
    const started = ref(!!restored);
    const editor = ref(null);
    const showLoad = ref(false);
    const showTemplates = ref(false);

    watch(holidays, (val) => {
      if (!started.value) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)); } catch {}
    }, { deep: true });

    function begin(items) {
      holidays.splice(0, holidays.length, ...items);
      started.value = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(holidays)); } catch {}
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
      started.value = false;
      holidays.splice(0, holidays.length);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }

    return { holidays, started, editor, showLoad, showTemplates, startFresh, onLoad, onTemplate, startOver };
  },
  template: `
    <div class="manual-view">
      <section v-if="!started" class="start-panel">
        <h2>Get started</h2>
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
          <button type="button" class="secondary outline" @click="startOver">Start over</button>
        </template>
      </holiday-editor>
    </div>`,
};
