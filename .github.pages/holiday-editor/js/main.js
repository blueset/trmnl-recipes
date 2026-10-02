// App entry: header navigation + hash-routed views.

import { route } from './router.js';
import { ConfirmHost } from './components/dialogs.js';
import { LandingView } from './components/LandingView.js';
import { ManualView } from './components/ManualView.js';
import { TrmnlView } from './components/TrmnlView.js';
import { ReferenceView } from './components/ReferenceView.js';

const { createApp, computed, watch, nextTick } = Vue;

const TITLES = {
  home: 'Holiday Config Editor',
  manual: 'Edit YAML manually',
  trmnl: 'Edit my TRMNL plugins',
  reference: 'YAML specification',
};

const app = createApp({
  components: { ConfirmHost, LandingView, ManualView, TrmnlView, ReferenceView },
  setup() {
    const view = computed(() => ({
      home: 'landing-view', manual: 'manual-view', trmnl: 'trmnl-view', reference: 'reference-view',
    })[route.name] || 'landing-view');

    watch(() => route.name, (name) => {
      document.title = `${name === 'home' ? '' : TITLES[name] + ' — '}Holiday Config Editor — TRMNL Recipes`;
      if (name === 'reference') nextTick(() => document.getElementById('reference')?.scrollIntoView());
    }, { immediate: true });

    return { route, view, TITLES };
  },
  template: `
    <header class="app-header">
      <a href="#" class="app-title"><h1>Holiday Config Editor</h1></a>
      <nav aria-label="Entry points">
        <a href="#trmnl" :aria-current="route.name === 'trmnl' ? 'page' : undefined">My TRMNL plugins</a>
        <a href="#manual" :aria-current="route.name === 'manual' ? 'page' : undefined">Manual YAML</a>
        <a href="#reference" :aria-current="route.name === 'reference' ? 'page' : undefined">YAML spec</a>
      </nav>
    </header>
    <p v-if="route.name !== 'home'" class="app-subtitle">{{ TITLES[route.name] }} · for the
      <a href="https://github.com/blueset/trmnl-recipes/tree/master/custom-next-holiday">Custom Next Holiday</a> TRMNL recipe.</p>
    <main>
      <component :is="view"></component>
    </main>
    <confirm-host></confirm-host>`,
});

app.config.compilerOptions.isCustomElement = (tag) => tag === 'selectedcontent' || tag === 'iconify-icon';
app.mount('#app');
