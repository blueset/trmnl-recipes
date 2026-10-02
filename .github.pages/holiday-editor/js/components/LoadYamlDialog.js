// Paste-YAML dialog.

import { ModalDialog } from './dialogs.js';
import { parseHolidaysYaml } from '../holiday-model.js';

const { ref, watch } = Vue;

export const LoadYamlDialog = {
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
    watch(() => props.open, (open) => {
      if (open) { text.value = props.initialText; error.value = ''; }
    });
    function load() {
      const result = parseHolidaysYaml(text.value);
      if (result.error) { error.value = result.error; return; }
      emit('load', result.items, text.value);
    }
    return { text, error, load, close: () => emit('close') };
  },
  template: `
    <modal-dialog :open="open" :title="title" @close="close">
      <slot></slot>
      <textarea class="yaml-textarea" v-model="text" placeholder="Paste your holidays YAML here…"></textarea>
      <div v-if="error" class="field-error">{{ error }}</div>
      <template #actions>
        <button class="secondary" @click="close">Cancel</button>
        <button @click="load">{{ confirmLabel }}</button>
      </template>
    </modal-dialog>`,
};
