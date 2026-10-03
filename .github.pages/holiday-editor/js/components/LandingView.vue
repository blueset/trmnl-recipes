<script setup>
import { store } from '../store.js';
import TrmnlSignIn from './TrmnlSignIn.vue';
let hasDraft = false;
try { hasDraft = Array.isArray(JSON.parse(localStorage.getItem('trmnl-holiday-editor') || 'null')); }
catch (error) { console.warn('Could not read holiday draft.', error); }
</script>
<template>
  <section class="landing">
    <div class="hero">
      <p class="eyebrow">{{ store.session ? 'Connected to TRMNL' : 'A little anticipation, every day' }}</p>
      <h1>Your holidays, on TRMNL.</h1>
      <p class="lead">{{ store.session ? 'Update your holiday plugins directly, add dates that matter to you, and share a list across your devices.' : 'Sign in with TRMNL to load and save your holiday plugins directly. Start with a template, then make it your own.' }}</p>
    </div>
    <template v-if="store.session">
      <article class="connection-primary">
        <span class="entry-icon"><iconify-icon icon="simple-icons:trmnl" width="26" height="26" aria-hidden="true"/></span>
        <h2>Edit your TRMNL plugins</h2>
        <p>Open a plugin to edit its holidays and save straight to TRMNL. No YAML copying needed.</p>
        <a class="primary-link" href="#trmnl">Open my plugins <span aria-hidden="true">&rarr;</span></a>
      </article>
      <div class="connection-secondary">
        <a class="local-option" href="#manual"><span class="entry-icon"><iconify-icon icon="fluent:edit-24-regular" width="22" height="22" aria-hidden="true"/></span><span><strong>Edit local list</strong><small>{{ hasDraft ? 'Continue your draft in this browser.' : 'Create a browser draft and export YAML.' }}</small></span></a>
      </div>
    </template>
    <trmnl-sign-in v-else embedded return-hash="#trmnl">
      <template #secondary>
        <a class="local-option" href="#trmnl"><span class="entry-icon"><iconify-icon icon="fluent:key-24-regular" width="22" height="22" aria-hidden="true"/></span><span><strong>Use an API key instead</strong><small>Alternative with full account access.</small></span></a>
        <a class="local-option" href="#manual"><span class="entry-icon"><iconify-icon icon="fluent:edit-24-regular" width="22" height="22" aria-hidden="true"/></span><span><strong>Edit local list</strong><small>{{ hasDraft ? 'Continue your draft in this browser.' : 'Create a browser draft and export YAML.' }}</small></span></a>
      </template>
    </trmnl-sign-in>
    <p class="landing-note">Public holidays, lunar festivals, birthdays, paydays, and more. No date-code knowledge needed. <a href="#reference">Explore the guide</a>.</p>
  </section>
</template>
