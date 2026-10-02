<script>
// Copy the current holidays list to other instances, with explicit confirmation.

import { ModalDialog } from './dialogs.js';
import { store, ensureDiscovered } from '../store.js';
import { readInstance, writeInstance } from '../trmnl-api.js';

import { ref, reactive, computed, watch } from 'vue';

async function writeWithRetry(id, yaml) {
  for (let attempt = 0; ; attempt++) {
    const fresh = await readInstance(id);
    try {
      return await writeInstance(fresh, { list: yaml });
    } catch (e) {
      if (e.code !== 'conflict' || attempt >= 1) throw e;
    }
  }
}

export default {
  name: 'CloneDialog',
  components: { ModalDialog },
  props: {
    open: { type: Boolean, default: false },
    sourceId: { type: String, required: true },
    sourceName: { type: String, default: '' },
    yaml: { type: String, required: true },
    count: { type: Number, required: true },
    unsaved: { type: Boolean, default: false },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const selected = ref(new Set());
    const acknowledged = ref(false);
    const phase = ref('select'); // select | running | done
    const rows = reactive({}); // id -> { status: 'pending'|'running'|'ok'|'error', message }
    const loadError = ref('');

    const targets = computed(() => store.instances.filter((i) => i.id !== props.sourceId));

    watch(() => props.open, async (open) => {
      if (!open) return;
      phase.value = 'select';
      acknowledged.value = false;
      loadError.value = '';
      for (const k of Object.keys(rows)) delete rows[k];
      try {
        await ensureDiscovered();
      } catch (e) {
        loadError.value = e.message;
      }
      selected.value = new Set(targets.value.map((i) => i.id));
    });

    function toggle(id) {
      const s = new Set(selected.value);
      s.has(id) ? s.delete(id) : s.add(id);
      selected.value = s;
    }

    async function runFor(ids) {
      phase.value = 'running';
      for (const id of ids) rows[id] = { status: 'pending', message: '' };
      for (const id of ids) {
        rows[id] = { status: 'running', message: '' };
        try {
          await writeWithRetry(id, props.yaml);
          rows[id] = { status: 'ok', message: 'Updated' };
        } catch (e) {
          rows[id] = {
            status: 'error',
            message: e.code === 'forbidden' ? 'No access to this plugin'
              : e.code === 'conflict' ? 'Changed by someone else while copying'
              : e.message,
          };
        }
      }
      phase.value = 'done';
    }

    const failedIds = computed(() => Object.keys(rows).filter((id) => rows[id].status === 'error'));
    const okCount = computed(() => Object.values(rows).filter((r) => r.status === 'ok').length);
    const nameOf = (id) => targets.value.find((i) => i.id === id)?.name || `#${id}`;

    return {
      store, targets, selected, acknowledged, phase, rows, loadError, failedIds, okCount, nameOf, toggle,
      start: () => runFor([...selected.value]),
      retry: () => runFor(failedIds.value),
      close: () => { if (phase.value !== 'running') emit('close'); },
    };
  },
};
</script>
<template>

    <modal-dialog :open="open" title="Copy holidays to other plugins" :dismissible="phase !== 'running'" @close="close">
      <template v-if="phase === 'select'">
        <p>Replace the holidays list of the selected plugins with the {{ count }} holiday{{ count === 1 ? '' : 's' }} from
          <strong>{{ sourceName || ('#' + sourceId) }}</strong>. Their "number of holidays" setting and names are not changed.</p>
        <p v-if="unsaved" class="notice">This copies what is in the editor now, including changes you haven't saved to this plugin yet.</p>
        <div v-if="store.discovery.state === 'loading'" class="muted">Finding your other plugins…</div>
        <div v-else-if="loadError" class="field-error">{{ loadError }}</div>
        <p v-else-if="!targets.length" class="muted">You have no other Custom Next Holiday plugins.</p>
        <ul v-else class="clone-targets">
          <li v-for="inst in targets" :key="inst.id">
            <label>
              <input type="checkbox" :checked="selected.has(inst.id)" @change="toggle(inst.id)">
              {{ inst.name }} <span class="muted">#{{ inst.id }}</span>
              <span v-if="inst.installed === true" class="badge">installed</span>
              <span v-else-if="inst.installed === false" class="badge">forked</span>
            </label>
          </li>
        </ul>
        <label v-if="selected.size" class="acknowledge">
          <input type="checkbox" v-model="acknowledged">
          I understand this overwrites the holidays on {{ selected.size }} plugin{{ selected.size === 1 ? '' : 's' }} and can't be undone here.
        </label>
      </template>
      <template v-else>
        <ul class="clone-results">
          <li v-for="(row, id) in rows" :key="id" :class="row.status">
            <span class="clone-status" aria-hidden="true">{{ row.status === 'ok' ? '✓' : row.status === 'error' ? '✕' : row.status === 'running' ? '…' : '·' }}</span>
            {{ nameOf(id) }} <span class="muted">{{ row.message }}</span>
          </li>
        </ul>
        <p v-if="phase === 'done'">{{ okCount }} updated<template v-if="failedIds.length">, {{ failedIds.length }} failed</template>.</p>
      </template>
      <template #actions>
        <template v-if="phase === 'select'">
          <button type="button" class="secondary" @click="close">Cancel</button>
          <button type="button" class="danger" :disabled="!selected.size || !acknowledged" @click="start">
            Overwrite {{ selected.size }} plugin{{ selected.size === 1 ? '' : 's' }}
          </button>
        </template>
        <template v-else>
          <button v-if="phase === 'done' && failedIds.length" type="button" class="secondary" @click="retry">Retry failed</button>
          <button type="button" :disabled="phase === 'running'" @click="close">Close</button>
        </template>
      </template>
    </modal-dialog>
</template>
