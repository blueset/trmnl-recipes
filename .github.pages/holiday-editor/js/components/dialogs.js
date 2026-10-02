// Modal dialog primitive and a promise-based confirm service.

const { reactive, watch, onMounted, onBeforeUnmount } = Vue;

// Open modals in stacking order; only the topmost reacts to Escape.
const modalStack = [];
let modalSeq = 0;

export const ModalDialog = {
  name: 'ModalDialog',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    wide: { type: Boolean, default: false },
    dismissible: { type: Boolean, default: true },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const id = ++modalSeq;
    const unstack = () => {
      const i = modalStack.indexOf(id);
      if (i >= 0) modalStack.splice(i, 1);
    };
    watch(() => props.open, (open) => {
      unstack();
      if (open) modalStack.push(id);
    }, { immediate: true });
    function onKey(e) {
      if (e.key !== 'Escape' || !props.open || !props.dismissible) return;
      if (modalStack[modalStack.length - 1] !== id) return;
      e.stopPropagation();
      emit('close');
    }
    onMounted(() => window.addEventListener('keydown', onKey));
    onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); unstack(); });
    return { onOverlay: () => props.dismissible && emit('close') };
  },
  template: `
    <div v-if="open" class="modal-overlay" @click.self="onOverlay">
      <div class="modal-dialog" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
        <h3 v-if="title">{{ title }}</h3>
        <slot></slot>
        <div v-if="$slots.actions" class="modal-actions"><slot name="actions"></slot></div>
      </div>
    </div>`,
};

const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  details: [],
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  danger: false,
  resolve: null,
});

/**
 * Show a confirmation dialog.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title = 'Are you sure?', message = '', details = [], confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  if (confirmState.resolve) confirmState.resolve(false);
  return new Promise((resolve) => {
    Object.assign(confirmState, { open: true, title, message, details, confirmLabel, cancelLabel, danger, resolve });
  });
}

export const ConfirmHost = {
  name: 'ConfirmHost',
  components: { ModalDialog },
  setup() {
    function close(result) {
      const resolve = confirmState.resolve;
      confirmState.open = false;
      confirmState.resolve = null;
      if (resolve) resolve(result);
    }
    return { state: confirmState, close };
  },
  template: `
    <modal-dialog :open="state.open" :title="state.title" @close="close(false)">
      <p v-if="state.message">{{ state.message }}</p>
      <ul v-if="state.details.length" class="confirm-details">
        <li v-for="(d, i) in state.details" :key="i">{{ d }}</li>
      </ul>
      <template #actions>
        <button class="secondary" @click="close(false)">{{ state.cancelLabel }}</button>
        <button :class="{ 'danger': state.danger }" @click="close(true)" autofocus>{{ state.confirmLabel }}</button>
      </template>
    </modal-dialog>`,
};
