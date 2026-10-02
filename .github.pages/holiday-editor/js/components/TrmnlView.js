// "Edit my TRMNL plugins" entry point.

import { TrmnlSignIn } from './TrmnlSignIn.js';
import { InstancePicker } from './InstancePicker.js';
import { TrmnlInstanceEditor } from './TrmnlInstanceEditor.js';
import { store } from '../store.js';
import { route } from '../router.js';
import { signOut, grantedScopes } from '../auth.js';
import { getMe } from '../trmnl-api.js';

const { ref, computed, watch } = Vue;

export const TrmnlView = {
  name: 'TrmnlView',
  components: { TrmnlSignIn, InstancePicker, TrmnlInstanceEditor },
  setup() {
    const editor = ref(null);
    const me = ref(null);
    const instanceId = computed(() => route.params.id || '');
    const canWrite = computed(() => !!store.session && grantedScopes().includes('content'));

    watch(() => store.session?.accessToken && store.session.type, async (signedIn) => {
      me.value = null;
      // /me needs the "profile" capability, which this editor doesn't request.
      if (!signedIn || (store.session.type !== 'apikey' && !grantedScopes().includes('profile'))) return;
      try { me.value = await getMe(); } catch {}
    }, { immediate: true });

    const who = computed(() => {
      const m = me.value;
      const label = m && (m.name || m.email || m.first_name);
      const how = store.session?.type === 'apikey' ? 'API key' : 'TRMNL';
      return label ? `${label} (via ${how})` : `Signed in via ${how}`;
    });

    async function logout() {
      if (editor.value?.isDirty()) {
        if (!(await editor.value.confirmDiscard())) return;
        editor.value.markDiscarded();
      }
      signOut();
    }

    return { store, route, editor, instanceId, canWrite, who, logout };
  },
  template: `
    <div class="trmnl-view">
      <div v-if="store.session" class="session-bar">
        <span><iconify-icon icon="fluent:person-circle-20-regular" width="20"></iconify-icon> {{ who }}</span>
        <button type="button" class="secondary outline" @click="logout">Sign out</button>
      </div>
      <p v-if="store.session && !canWrite" class="notice">This sign-in was not granted the "content" permission, so changes can't be saved. Sign out and connect again to grant it.</p>

      <trmnl-sign-in v-if="!store.session" :return-hash="instanceId ? '#trmnl/' + instanceId : '#trmnl'"
        :notice="instanceId ? 'Sign in to open plugin #' + instanceId + '. Unsaved edits from this tab will be offered for restore.' : ''"></trmnl-sign-in>
      <trmnl-instance-editor v-else-if="instanceId" ref="editor" :key="instanceId" :id="instanceId"></trmnl-instance-editor>
      <instance-picker v-else></instance-picker>
    </div>`,
};
