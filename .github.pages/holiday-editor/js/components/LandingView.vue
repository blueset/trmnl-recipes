<script setup>
import { store } from '../store.js';
let hasDraft = false;
try { hasDraft = Array.isArray(JSON.parse(localStorage.getItem('trmnl-holiday-editor') || 'null')); }
catch (error) { console.warn('Could not read holiday draft.', error); }
</script>
<template>
  <section class="landing">
    <div class="hero"><p class="eyebrow">A little anticipation, every day</p><h1>Make room for the dates<br>that matter to you.</h1><p class="lead">Build a holiday list for your TRMNL. Start with a template, add your own important dates, and see what's coming next.</p></div>
    <div class="entry-cards">
      <a class="entry-card" href="#trmnl"><span class="entry-icon"><iconify-icon icon="fluent:tablet-24-regular" width="26" height="26" aria-hidden="true"/></span><h2>Edit your TRMNL plugins</h2><p>Connect your account to load and save lists directly. Share a list across your holiday plugins.</p><span class="entry-cta">{{ store.session ? 'Open my plugins' : 'Connect with TRMNL' }} &rarr;</span></a>
      <a class="entry-card" href="#manual"><span class="entry-icon"><iconify-icon icon="fluent:edit-24-regular" width="26" height="26" aria-hidden="true"/></span><h2>Edit without signing in</h2><p>Create a list right here, then copy it into your plugin settings. Your draft stays in this browser.</p><span class="entry-cta">{{ hasDraft ? 'Continue your draft' : 'Create a holiday list' }} &rarr;</span></a>
    </div>
    <p class="landing-note">Public holidays, lunar festivals, birthdays, paydays, and more. No date-code knowledge needed. <a href="#reference">Explore the guide</a>.</p>
  </section>
</template>
