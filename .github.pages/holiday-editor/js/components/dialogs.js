import { reactive } from 'vue';
export { default as ModalDialog } from './ModalDialog.vue';
export { default as ConfirmHost } from './ConfirmHost.vue';

export const confirmState = reactive({
  open: false, title: '', message: '', details: [], confirmLabel: 'OK',
  cancelLabel: 'Cancel', danger: false, resolve: null,
});

export function confirmDialog({ title = 'Are you sure?', message = '', details = [], confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  if (confirmState.resolve) confirmState.resolve(false);
  return new Promise((resolve) => {
    Object.assign(confirmState, { open: true, title, message, details, confirmLabel, cancelLabel, danger, resolve });
  });
}
