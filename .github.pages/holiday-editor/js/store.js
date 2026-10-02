// Shared reactive state for the TRMNL entry point.

import { getSession, onSessionChange } from './auth.js';
import { clearFingerprintCache, discoverInstances, probeInstance } from './trmnl-api.js';

import { reactive } from 'vue';

export const store = reactive({
  session: getSession(),
  instances: [],
  discovery: { state: 'idle', done: 0, total: 0, scanned: 0, forbidden: 0, error: '' },
});

onSessionChange((session) => {
  const changedUser = !session || !store.session || session.type !== store.session.type
    || (session.type === 'apikey' && session.accessToken !== store.session.accessToken);
  store.session = session;
  if (changedUser) resetInstances();
});

export function resetInstances() {
  store.instances = [];
  Object.assign(store.discovery, { state: 'idle', done: 0, total: 0, scanned: 0, forbidden: 0, error: '' });
}

let inFlight = null;

export function discover({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (force) clearFingerprintCache();
  Object.assign(store.discovery, { state: 'loading', done: 0, total: 0, error: '' });
  inFlight = discoverInstances({
    onProgress: (done, total) => Object.assign(store.discovery, { done, total }),
  }).then(({ instances, scanned, forbidden }) => {
    const manual = store.instances.filter((i) => i.manual && !instances.some((x) => x.id === i.id));
    store.instances = [...instances, ...manual];
    Object.assign(store.discovery, { state: 'done', scanned, forbidden });
  }).catch((e) => {
    Object.assign(store.discovery, { state: 'error', error: e.message });
    throw e;
  }).finally(() => { inFlight = null; });
  return inFlight;
}

export function ensureDiscovered() {
  if (store.discovery.state === 'done') return Promise.resolve();
  return discover();
}

export async function addInstanceById(id) {
  const clean = String(id).trim().replace(/^#/, '');
  if (!/^\d+$/.test(clean)) throw new Error('Plugin setting IDs are numbers (see the URL of the plugin settings page).');
  const existing = store.instances.find((i) => i.id === clean);
  if (existing) return existing;
  const inst = { ...(await probeInstance(clean)), manual: true };
  store.instances.push(inst);
  return inst;
}

export function updateInstanceName(id, name) {
  const inst = store.instances.find((i) => i.id === String(id));
  if (inst) inst.name = name;
}
