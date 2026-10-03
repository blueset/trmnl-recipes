<script>
// Sign-in panel: OAuth (Developer App) or account API key.

import { beginOAuth, isOAuthConfigured, signInWithApiKey } from '../auth.js';
import { validateApiKey } from '../trmnl-api.js';

import { ref } from 'vue';

export default {
  name: 'TrmnlSignIn',
  props: { returnHash: { type: String, default: '#trmnl' }, notice: { type: String, default: '' }, embedded: Boolean },
  setup(props) {
    const oauthReady = isOAuthConfigured();
    const apiKey = ref('');
    const busy = ref(false);
    const error = ref('');

    async function connect() {
      error.value = '';
      busy.value = true;
      try {
        await beginOAuth(props.returnHash);
      } catch (e) {
        error.value = e.message;
        busy.value = false;
      }
    }

    async function useApiKey() {
      error.value = '';
      busy.value = true;
      try {
        await validateApiKey(apiKey.value);
        signInWithApiKey(apiKey.value);
        apiKey.value = '';
      } catch (e) {
        error.value = e.status === 401 ? 'That API key was rejected by TRMNL.' : e.message;
      } finally {
        busy.value = false;
      }
    }

    return { oauthReady, apiKey, busy, error, connect, useApiKey };
  },
};
</script>
<template>

    <section class="signin">
      <template v-if="!embedded">
        <p class="eyebrow">Straight to your device</p>
        <h1>Connect your TRMNL account</h1>
        <p>Sign in to load and save the holiday lists of your <strong>Custom Next Holiday</strong> plugins directly.
          Everything runs in your browser; credentials are stored only in this browser’s local storage.</p>
      </template>
      <p v-if="notice" class="notice">{{ notice }}</p>
      <div :class="{ 'signin-options': !embedded }">
        <article class="connection-primary">
          <span class="entry-icon"><iconify-icon icon="simple-icons:trmnl" width="26" height="26" aria-hidden="true"/></span>
          <h2>Sign in with TRMNL</h2>
          <p>Recommended. Authorize this editor to read and update your plugin settings, without copying an API key. You can revoke access from your TRMNL account.</p>
          <button type="button" :disabled="!oauthReady || busy" @click="connect">Connect with TRMNL</button>
          <p v-if="embedded" class="connection-privacy">Sign-in tokens are stored in this browser. Sign out on shared computers.</p>
          <p v-if="!oauthReady" class="muted"><small>OAuth sign-in is not configured for this copy of the editor. Use an API key instead.</small></p>
        </article>
        <article v-if="!embedded" class="api-key-panel">
          <span class="entry-icon"><iconify-icon icon="fluent:key-24-regular" width="26" height="26" aria-hidden="true"/></span>
          <h2>Use an API key</h2>
          <p>Paste your account API key from <a href="https://trmnl.com/account" target="_blank" rel="noopener">trmnl.com/account</a>.
            The key is stored in this browser and has full account access; sign out when you're done on shared computers.</p>
          <form @submit.prevent="useApiKey" class="inline-fields">
            <input type="password" v-model="apiKey" placeholder="Account API key" autocomplete="off" aria-label="Account API key">
            <button type="submit" class="secondary" :disabled="!apiKey.trim() || busy">Sign in</button>
          </form>
        </article>
      </div>
      <div v-if="$slots.secondary" class="connection-secondary"><slot name="secondary"/></div>
      <div v-if="error" class="field-error" role="alert">{{ error }}</div>
    </section>
</template>
