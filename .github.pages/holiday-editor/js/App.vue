<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { route } from './router.js';
import { ConfirmHost } from './components/dialogs.js';
import LandingView from './components/LandingView.vue';
import ManualView from './components/ManualView.vue';
import TrmnlView from './components/TrmnlView.vue';
import ReferenceView from './components/ReferenceView.vue';
import { getTheme, saveTheme } from './theme.js';

const theme = ref(getTheme());
const main = ref(null);
const titles = { home: 'Holiday Editor', manual: 'Local editor', trmnl: 'My TRMNL plugins', reference: 'Guide & reference' };
const view = computed(() => ({ home: LandingView, manual: ManualView, trmnl: TrmnlView, reference: ReferenceView })[route.name]);
watch(() => route.name, async (name, previous) => {
  document.title = `${titles[name]}${name === 'home' ? '' : ' - Holiday Editor'} - TRMNL Recipes`;
  if (previous !== undefined) { await nextTick(); main.value?.focus({ preventScroll: true }); }
}, { immediate: true });
watch(theme, saveTheme);
</script>

<template>
  <a class="skip-link" href="#main" @click.prevent="main?.focus()">Skip to content</a>
  <header class="app-header">
    <a href="#" class="app-title" aria-label="Holiday Editor home">
      <iconify-icon class="brand-icon" icon="fluent:calendar-24-regular" width="100%" height="100%" aria-hidden="true"/>
      <span>Holiday Editor<small>for TRMNL</small></span>
    </a>
    <nav aria-label="Main navigation">
      <a href="#trmnl" :aria-current="route.name === 'trmnl' ? 'page' : undefined">My plugins</a>
      <a href="#manual" :aria-current="route.name === 'manual' ? 'page' : undefined">Local editor</a>
      <a href="#reference" :aria-current="route.name === 'reference' ? 'page' : undefined">Guide</a>
    </nav>
    <label class="theme-control"><span class="sr-only">Appearance</span>
      <select v-model="theme" aria-label="Appearance"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select>
    </label>
  </header>
  <main id="main" ref="main" tabindex="-1"><component :is="view"/></main>
  <footer class="app-footer"><span>Made for your next important date.</span><a href="https://github.com/blueset/trmnl-recipes/tree/master/custom-next-holiday" target="_blank" rel="noopener">Custom Next Holiday recipe</a></footer>
  <confirm-host/>
</template>
