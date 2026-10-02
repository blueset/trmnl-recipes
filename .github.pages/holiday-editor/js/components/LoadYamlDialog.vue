<script>
// Paste-YAML dialog.

import { ModalDialog } from './dialogs.js';
import { parseHolidaysYaml } from '../holiday-model.js';

import { ref, watch, useId } from 'vue';

export default {
  name: 'LoadYamlDialog',
  components: { ModalDialog },
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: 'Load YAML' },
    confirmLabel: { type: String, default: 'Load' },
    initialText: { type: String, default: '' },
  },
  emits: ['load', 'close'],
  setup(props, { emit }) {
    const text = ref('');
    const error = ref('');
    const id = useId();
    watch(() => props.open, (open) => {
      if (open) { text.value = props.initialText; error.value = ''; }
    });
    function load() {
      const result = parseHolidaysYaml(text.value);
      if (result.error) { error.value = result.error; return; }
      emit('load', result.items, text.value);
    }
    return { text, error, id, load, close: () => emit('close') };
  },
};
</script>
<template>

    <modal-dialog :open="open" :title="title" @close="close">
      <slot></slot>
      <label :for="id">Holiday YAML</label>
      <textarea :id="id" class="yaml-textarea" v-model="text" placeholder="Paste your holidays YAML here…" spellcheck="false" :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? id + '-error' : undefined"></textarea>
      <div v-if="error" :id="id + '-error'" class="field-error" role="alert">{{ error }}</div>
      <template #actions>
        <button class="secondary" @click="close">Cancel</button>
        <button @click="load">{{ confirmLabel }}</button>
      </template>
    </modal-dialog>
</template>
