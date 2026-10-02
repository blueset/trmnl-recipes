// Iconify search dialog.

import { ModalDialog } from './dialogs.js';

const { reactive, watch, nextTick, ref } = Vue;

export const IconPicker = {
  name: 'IconPicker',
  components: { ModalDialog },
  props: { open: { type: Boolean, default: false } },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const state = reactive({ query: '', results: [], loading: false, searched: false, hovered: '' });
    const input = ref(null);
    let timer = null;
    let seq = 0;

    watch(() => props.open, (open) => {
      if (!open) return;
      Object.assign(state, { query: '', results: [], loading: false, searched: false, hovered: '' });
      nextTick(() => input.value?.focus());
    });

    async function search(q) {
      const mySeq = ++seq;
      state.loading = true;
      state.searched = true;
      try {
        const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=128`);
        const data = await res.json();
        if (mySeq === seq) state.results = data.icons || [];
      } catch {
        if (mySeq === seq) state.results = [];
      } finally {
        if (mySeq === seq) state.loading = false;
      }
    }

    function onInput() {
      clearTimeout(timer);
      const q = state.query.trim();
      if (!q) { state.results = []; state.searched = false; return; }
      timer = setTimeout(() => search(q), 300);
    }

    return { state, input, onInput, select: (name) => emit('select', name), close: () => emit('close') };
  },
  template: `
    <modal-dialog :open="open" title="Pick an Icon" wide @close="close">
      <input ref="input" type="search" v-model="state.query" placeholder="Search icons…" @input="onInput">
      <div v-if="state.loading" class="muted-center">Searching…</div>
      <div v-else-if="state.results.length === 0 && state.searched" class="muted-center">No icons found.</div>
      <div class="icon-grid">
        <button v-for="name in state.results" :key="name" type="button" @click="select(name)" :title="name"
                @mouseenter="state.hovered = name" @mouseleave="state.hovered = ''">
          <iconify-icon :icon="name" width="28"></iconify-icon>
        </button>
      </div>
      <template #actions>
        <span class="icon-picker-hovered">{{ state.hovered }}</span>
        <button class="secondary" @click="close">Cancel</button>
      </template>
    </modal-dialog>`,
};
