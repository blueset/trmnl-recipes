// Home: the three entry points.

import { store } from '../store.js';

export const LandingView = {
  name: 'LandingView',
  setup() {
    let hasDraft = false;
    try { hasDraft = (JSON.parse(localStorage.getItem('trmnl-holiday-editor') || '[]') || []).length > 0; } catch {}
    return { store, hasDraft };
  },
  template: `
    <section class="landing">
      <p class="lead">Build the list of dates that your <a href="https://github.com/blueset/trmnl-recipes/tree/master/custom-next-holiday">Custom Next Holiday</a>
        plugin counts down to — public holidays, lunar festivals, birthdays, paydays, launches, anything with a date.</p>
      <div class="entry-cards">
        <a class="entry-card" href="#trmnl">
          <iconify-icon icon="fluent-emoji-flat:satellite-antenna" width="48"></iconify-icon>
          <h3>Edit my TRMNL plugins</h3>
          <p>Sign in to TRMNL, pick a plugin and save changes straight to your device. Copy one list to all your plugins.</p>
          <span class="entry-cta">{{ store.session ? 'Open my plugins →' : 'Sign in →' }}</span>
        </a>
        <a class="entry-card" href="#manual">
          <iconify-icon icon="fluent-emoji-flat:memo" width="48"></iconify-icon>
          <h3>Edit YAML manually</h3>
          <p>No sign-in. Load or build a list in the browser and copy the YAML into your plugin settings.</p>
          <span class="entry-cta">{{ hasDraft ? 'Continue your draft →' : 'Open editor →' }}</span>
        </a>
        <a class="entry-card" href="#reference">
          <iconify-icon icon="fluent-emoji-flat:open-book" width="48"></iconify-icon>
          <h3>YAML specification</h3>
          <p>Every field and date format the plugin understands, with examples.</p>
          <span class="entry-cta">Read the reference →</span>
        </a>
      </div>
      <p class="muted"><small>Both editors include ready-made templates: public holidays for several countries, Chinese, Korean, Jewish, Islamic and Persian festivals,
        daylight-saving changes, birthdays, paydays, bills, school terms and more.</small></p>
    </section>`,
};
