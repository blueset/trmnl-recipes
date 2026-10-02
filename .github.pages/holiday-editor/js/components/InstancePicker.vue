<script>
// Lists the signed-in user's supported plugin instances.

import { store, discover, addInstanceById } from '../store.js';
import { navigate } from '../router.js';

import { ref, onMounted } from 'vue';

export default {
  name: 'InstancePicker',
  setup() {
    const manualId = ref('');
    const addError = ref('');
    const adding = ref(false);

    onMounted(() => {
      if (store.discovery.state === 'idle') discover().catch(() => {});
    });

    async function addById() {
      addError.value = '';
      adding.value = true;
      try {
        const inst = await addInstanceById(manualId.value);
        manualId.value = '';
        navigate(`#trmnl/${inst.id}`);
      } catch (e) {
        addError.value = e.code === 'unsupported'
          ? 'That plugin is not a Custom Next Holiday instance.'
          : e.code === 'not_found' ? 'No plugin with that ID was found in your account.'
          : e.message;
      } finally {
        adding.value = false;
      }
    }

    return { store, manualId, addError, adding, addById, rescan: () => discover({ force: true }).catch(() => {}) };
  },
};
</script>
<template>

    <section class="instance-picker">
      <div class="section-header">
        <h1>Your holiday plugins</h1>
        <button type="button" class="secondary outline" :disabled="store.discovery.state === 'loading'" @click="rescan">Rescan</button>
      </div>

      <div v-if="store.discovery.state === 'loading'" class="scan-progress">
        <progress :value="store.discovery.done" :max="store.discovery.total || null"></progress>
        <small>Checking plugins… {{ store.discovery.done }}<template v-if="store.discovery.total"> / {{ store.discovery.total }}</template></small>
      </div>
      <div v-else-if="store.discovery.state === 'error'" class="field-error" role="alert">
        Couldn't load your plugins: {{ store.discovery.error }}
      </div>

      <ul v-if="store.instances.length" class="instance-list">
        <li v-for="inst in store.instances" :key="inst.id">
          <a :href="'#trmnl/' + inst.id">
            <iconify-icon icon="fluent-emoji-flat:calendar" width="28"></iconify-icon>
            <span class="instance-name">{{ inst.name }}</span>
            <span class="muted">#{{ inst.id }}</span>
            <span v-if="inst.installed === true" class="badge" title="Installed from a recipe">installed</span>
            <span v-else-if="inst.installed === false" class="badge" title="Your own copy of the plugin">forked</span>
            <span v-if="inst.manual" class="badge">added by ID</span>
          </a>
        </li>
      </ul>
      <div v-else-if="store.discovery.state === 'done'" class="empty-state">
        <p>No Custom Next Holiday plugins found in your account.</p>
        <p><a href="https://trmnl.com/recipes/257171" target="_blank" rel="noopener">Install the recipe on TRMNL</a>, then rescan.</p>
      </div>
      <p v-if="store.discovery.state === 'done' && store.discovery.forbidden" class="muted">
        <small>{{ store.discovery.forbidden }} plugin{{ store.discovery.forbidden === 1 ? ' was' : 's were' }} skipped because this sign-in wasn't granted access to {{ store.discovery.forbidden === 1 ? 'it' : 'them' }}.</small>
      </p>

      <details class="add-by-id">
        <summary>Can't find your plugin?</summary>
        <p><small>Open the plugin's settings on trmnl.com and copy the number from the URL (<code>…/plugin_settings/<strong>12345</strong>/edit</code>).</small></p>
        <form @submit.prevent="addById" class="inline-fields">
          <input type="text" inputmode="numeric" v-model="manualId" placeholder="Plugin setting ID" aria-label="Plugin setting ID">
          <button type="submit" class="secondary" :disabled="!manualId.trim() || adding">Open</button>
        </form>
        <div v-if="addError" class="field-error">{{ addError }}</div>
      </details>
    </section>
</template>
