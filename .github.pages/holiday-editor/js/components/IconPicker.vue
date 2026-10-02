<script>
// Iconify search dialog.

import { ModalDialog } from './dialogs.js';

import { reactive, watch, nextTick, ref, onBeforeUnmount, useId } from 'vue';

export default {
  name: 'IconPicker',
  components: { ModalDialog },
  props: { open: { type: Boolean, default: false } },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const state = reactive({ query: '', results: [], loading: false, searched: false, hovered: '', error: '' });
    const input = ref(null);
    const id = useId();
    let timer = null;
    let seq = 0;

    watch(() => props.open, (open) => {
      clearTimeout(timer);
      ++seq;
      if (!open) return;
      Object.assign(state, { query: '', results: [], loading: false, searched: false, hovered: '', error: '' });
      nextTick(() => input.value?.focus());
    });

    async function search(q) {
      const mySeq = ++seq;
      state.loading = true;
      state.searched = true;
      state.error = '';
      try {
        const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=128`);
        if (!res.ok) throw new Error(`Icon search failed (HTTP ${res.status}).`);
        const data = await res.json();
        if (mySeq === seq) state.results = data.icons || [];
      } catch (error) {
        if (mySeq === seq) { state.results = []; state.error = 'Icon search is unavailable. Retry, or enter an icon identifier directly in the editor.'; }
        console.warn('Could not search Iconify.', error);
      } finally {
        if (mySeq === seq) state.loading = false;
      }
    }

    function onInput() {
      clearTimeout(timer);
      ++seq;
      const q = state.query.trim();
      state.loading = false;
      state.error = '';
      if (!q) { state.results = []; state.searched = false; return; }
      timer = setTimeout(() => search(q), 300);
    }

    onBeforeUnmount(() => { clearTimeout(timer); ++seq; });
    return { state, input, id, onInput, retry: () => search(state.query.trim()), select: (name) => emit('select', name), close: () => emit('close') };
  },
};
</script>
<template>

    <modal-dialog :open="open" title="Pick an Icon" wide @close="close">
      <label :for="id">Search icons</label><input :id="id" ref="input" type="search" v-model="state.query" placeholder="Try birthday, moon, or calendar" @input="onInput">
      <div v-if="state.error" class="notice error-notice" role="alert">{{ state.error }}<button type="button" class="secondary" @click="retry">Retry search</button></div>
      <div v-else-if="state.loading" class="muted-center" role="status">Searching…</div>
      <div v-else-if="state.results.length === 0 && state.searched" class="muted-center" role="status">No icons found. Try another search.</div>
      <p v-else-if="!state.searched" class="help-text">Search by a subject or icon name to find something that fits your holiday.</p>
      <div class="icon-grid">
        <button v-for="name in state.results" :key="name" type="button" @click="select(name)" :title="name" :aria-label="name"
                @mouseenter="state.hovered = name" @mouseleave="state.hovered = ''" @focus="state.hovered = name">
          <iconify-icon :icon="name" width="28" aria-hidden="true"></iconify-icon>
        </button>
      </div>
      <template #actions>
        <span class="icon-picker-hovered">{{ state.hovered }}</span>
        <button class="secondary" @click="close">Cancel</button>
      </template>
    </modal-dialog>
</template>
