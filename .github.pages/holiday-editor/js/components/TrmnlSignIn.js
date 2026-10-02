// Sign-in panel: OAuth (Developer App) or account API key.

import { beginOAuth, isOAuthConfigured, signInWithApiKey, signOut } from '../auth.js';
import { listPluginSettings } from '../trmnl-api.js';

const { ref } = Vue;

export const TrmnlSignIn = {
  name: 'TrmnlSignIn',
  props: { returnHash: { type: String, default: '#trmnl' }, notice: { type: String, default: '' } },
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
        signInWithApiKey(apiKey.value);
        // Validate the key before keeping it.
        await listPluginSettings();
        apiKey.value = '';
      } catch (e) {
        signOut();
        error.value = e.status === 401 ? 'That API key was rejected by TRMNL.' : e.message;
      } finally {
        busy.value = false;
      }
    }

    return { oauthReady, apiKey, busy, error, connect, useApiKey };
  },
  template: `
    <section class="signin">
      <h2>Connect your TRMNL account</h2>
      <p>Sign in to load and save the holiday lists of your <strong>Custom Next Holiday</strong> plugins directly.
        Everything runs in your browser; credentials are stored only in this browser's local storage.</p>
      <p v-if="notice" class="notice">{{ notice }}</p>
      <div class="signin-options">
        <article>
          <h3>Sign in with TRMNL</h3>
          <p>Recommended. Grants this editor access to read and update your plugin settings. You can revoke it any time from your TRMNL account.</p>
          <button type="button" :disabled="!oauthReady || busy" @click="connect">Connect with TRMNL</button>
          <p v-if="!oauthReady" class="muted"><small>OAuth sign-in is not configured for this copy of the editor. Use an API key instead.</small></p>
        </article>
        <article>
          <h3>Use an API key</h3>
          <p>Paste your account API key from <a href="https://trmnl.com/account" target="_blank" rel="noopener">trmnl.com/account</a>.
            It has full access to your account; sign out when you're done on shared computers.</p>
          <form @submit.prevent="useApiKey" class="inline-fields">
            <input type="password" v-model="apiKey" placeholder="Account API key" autocomplete="off" aria-label="Account API key">
            <button type="submit" class="secondary" :disabled="!apiKey.trim() || busy">Sign in</button>
          </form>
        </article>
      </div>
      <div v-if="error" class="field-error" role="alert">{{ error }}</div>
    </section>`,
};
