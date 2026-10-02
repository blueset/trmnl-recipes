<script setup>
import ModalDialog from './ModalDialog.vue';
import { confirmState as state } from './dialogs.js';
function close(result) {
  const resolve = state.resolve;
  state.open = false;
  state.resolve = null;
  resolve?.(result);
}
</script>
<template>
  <modal-dialog :open="state.open" :title="state.title" @close="close(false)">
    <p v-if="state.message">{{ state.message }}</p>
    <ul v-if="state.details.length" class="confirm-details"><li v-for="(detail, index) in state.details" :key="index">{{ detail }}</li></ul>
    <template #actions><button type="button" class="secondary" data-initial-focus @click="close(false)">{{ state.cancelLabel }}</button><button type="button" :class="{ danger: state.danger }" @click="close(true)">{{ state.confirmLabel }}</button></template>
  </modal-dialog>
</template>
