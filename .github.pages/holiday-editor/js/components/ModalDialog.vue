<script>
let openCount = 0;
let previousOverflow = '';
let focusOrigin = null;
// Safari does not focus buttons on pointer activation.
for (const type of ['click', 'focusin']) {
  document.addEventListener(type, event => {
    if (event.target instanceof Element) {
      focusOrigin = event.target.closest('button, summary, a[href], input, textarea, select, [tabindex]') || document.activeElement;
    }
  }, true);
}
</script>
<script setup>
import { ref, watch, nextTick, onBeforeUnmount, useId } from 'vue';

const props = defineProps({ open: Boolean, title: { type: String, default: '' }, wide: Boolean, dismissible: { type: Boolean, default: true } });
const emit = defineEmits(['close']);
const dialog = ref(null);
const titleId = useId();
let trigger = null;
let locked = false;

function release() {
  if (!locked) return;
  locked = false;
  if (--openCount === 0) document.body.style.overflow = previousOverflow;
}
function close() {
  dialog.value?.close();
  release();
  if (trigger?.isConnected) {
    const collapsed = trigger.closest('details:not([open])');
    const target = collapsed ? collapsed.querySelector('summary') : trigger;
    target?.focus({ preventScroll: true });
  }
}
watch(() => props.open, async (open) => {
  await nextTick();
  if (!dialog.value) return;
  if (open && !dialog.value.open) {
    trigger = focusOrigin?.isConnected ? focusOrigin : document.activeElement;
    if (openCount++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    locked = true;
    dialog.value.showModal();
    (dialog.value.querySelector('[data-initial-focus]') || dialog.value.querySelector('input, textarea, select') || dialog.value.querySelector('button') || dialog.value).focus();
  } else if (!open) close();
}, { immediate: true });
function dismiss() { if (props.dismissible) emit('close'); }
function onKey(event) {
  if (event.key !== 'Tab') return;
  const controls = [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.getClientRects().length);
  const first = controls[0];
  const last = controls.at(-1);
  if (!first) { event.preventDefault(); dialog.value.focus(); return; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
onBeforeUnmount(close);
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="modal-dialog" :class="{ wide }" :aria-labelledby="titleId" @cancel.prevent="dismiss" @keydown="onKey" @click="($event.target === dialog) && dismiss()">
      <div class="modal-header"><h2 :id="titleId">{{ title }}</h2><button v-if="dismissible" type="button" class="icon-button quiet" aria-label="Close dialog" @click="dismiss"><span aria-hidden="true">&times;</span></button></div>
      <div class="modal-content"><slot/></div>
      <div v-if="$slots.actions" class="modal-actions"><slot name="actions"/></div>
    </dialog>
  </Teleport>
</template>
