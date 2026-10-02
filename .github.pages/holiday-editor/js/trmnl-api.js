// Thin client for the TRMNL REST API (https://trmnl.com/api-docs).

import { API_BASE } from '../config.js';
import { getAccessToken, getSession, refreshSession, signOut } from './auth.js';
import { matchRecipeByKeys, recipeById } from './recipes.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', fieldErrors = [], body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function errorFromResponse(res, body) {
  const err = body?.error;
  const message = (typeof err === 'string' ? err : err?.message) || body?.message || res.statusText || `HTTP ${res.status}`;
  const codeByStatus = { 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 422: 'invalid', 429: 'rate_limited' };
  return new ApiError(message, {
    status: res.status,
    code: (typeof err === 'object' && err?.code) || codeByStatus[res.status] || `http_${res.status}`,
    fieldErrors: (typeof err === 'object' && err?.field_errors) || [],
    body,
  });
}

export async function request(method, path, { body, retryAuth = true, retries = 2 } = {}) {
  const token = await getAccessToken();
  if (!token) throw new ApiError('Not signed in.', { status: 401, code: 'signed_out' });

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error while contacting TRMNL.', { code: 'network' });
  }

  if (res.status === 401 && retryAuth) {
    const session = getSession();
    if (session?.type === 'oauth' && session.refreshToken) {
      await refreshSession({ staleToken: token });
      return request(method, path, { body, retryAuth: false, retries });
    }
    if (session?.type === 'apikey') signOut();
  }

  if (res.status === 429 && retries > 0) {
    const wait = Math.min(Number(res.headers.get('Retry-After')) || 5, 30) * 1000;
    await sleep(wait);
    return request(method, path, { body, retryAuth, retries: retries - 1 });
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) throw errorFromResponse(res, data);
  return data;
}

// ─── Endpoints ───

export const getMe = () => request('GET', '/me').then((r) => r?.data ?? r);
export const listPluginSettings = () => request('GET', '/plugin_settings').then((r) => r?.data || []);
export const patchSettingsFields = (id, fields) =>
  request('PATCH', `/plugin_settings/${encodeURIComponent(id)}/settings`, { body: { fields } });
export const getPluginSettingDetails = (id) => request('GET', `/plugin_settings/${encodeURIComponent(id)}/details`).then((r) => r?.data);
export const updatePluginSetting = (id, attrs) =>
  request('PATCH', `/plugin_settings/${encodeURIComponent(id)}`, { body: attrs }).then((r) => r?.data);

// ─── Instance read/write (recipe-aware) ───
// API keys and connected apps can't reach the revisioned /configuration endpoint, so instances are
// read via /details and written via PATCH /settings. Concurrent edits are detected client-side by
// re-reading and comparing a hash of the stored values right before writing.

// /details shape: `custom_fields` holds the plugin's form field definitions (keyname, default…),
// `settings.custom_fields_values` holds only the values the user has set. `form_fields` describes
// TRMNL's generic plugin settings (strategy, OAuth…) and is not relevant here.
const storedValues = (details) => details?.settings?.custom_fields_values || {};
const customFields = (details) => (Array.isArray(details?.custom_fields) ? details.custom_fields : []);

function detailsKeys(details) {
  const keys = new Set(Object.keys(storedValues(details)));
  for (const f of customFields(details)) if (f?.keyname) keys.add(f.keyname);
  return keys;
}

/** Stored value for a custom field, falling back to the field's default (what the plugin renders). */
function fieldValue(details, key) {
  const stored = storedValues(details);
  if (stored[key] !== undefined && stored[key] !== null) return { value: stored[key], stored: stored[key] };
  const def = customFields(details).find((f) => f?.keyname === key)?.default;
  return { value: def ?? null, stored: null };
}

const storedText = (v) => (v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v));

// FNV-1a hash of the stored values; changes whenever the instance is saved elsewhere.
function valuesRevision(values) {
  const text = `${storedText(values.list)}\u0000${storedText(values.number)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Read an instance's recipe data. */
export async function readInstance(id) {
  const details = await getPluginSettingDetails(id);
  const recipe = matchRecipeByKeys(detailsKeys(details));
  if (!recipe) throw new ApiError('This plugin is not a supported recipe.', { code: 'unsupported' });
  const list = fieldValue(details, recipe.fields.list);
  const number = fieldValue(details, recipe.fields.number);
  return {
    id: String(id),
    name: details?.name || '',
    revision: valuesRevision({ list: list.stored, number: number.stored }),
    recipe,
    values: { list: list.value ?? '', number: number.value },
  };
}

/**
 * Write recipe data to an instance. `changes` may contain `list` (YAML string) and/or `number`.
 * Throws ApiError with code 'conflict' when the instance changed since `instance` was read.
 * The returned instance carries any `warnings` reported by TRMNL.
 */
export async function writeInstance(instance, changes) {
  const { recipe } = instance;
  const fields = {};
  if (changes.list !== undefined) fields[recipe.fields.list] = String(changes.list);
  if (changes.number !== undefined) fields[recipe.fields.number] = String(changes.number);
  if (!Object.keys(fields).length) return instance;
  const current = await readInstance(instance.id);
  if (current.revision !== instance.revision) {
    throw new ApiError('This plugin was changed elsewhere since it was loaded.', { status: 409, code: 'conflict' });
  }
  const res = await patchSettingsFields(instance.id, fields);
  const warnings = (res?.data?.warnings || []).map((w) => (typeof w === 'string' ? w : w?.message || JSON.stringify(w)));
  return { ...(await readInstance(instance.id)), warnings };
}

// ─── Instance discovery ───

const FINGERPRINT_KEY = 'trmnl-holiday-editor:fingerprints:v3';

function loadFingerprints() {
  try { return JSON.parse(localStorage.getItem(FINGERPRINT_KEY) || '{}') || {}; } catch { return {}; }
}
function saveFingerprints(map) {
  try { localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(map)); } catch {}
}
export const clearFingerprintCache = () => localStorage.removeItem(FINGERPRINT_KEY);

async function fingerprint(id) {
  try {
    const details = await getPluginSettingDetails(id);
    return { recipe: matchRecipeByKeys(detailsKeys(details)), status: 'ok' };
  } catch (e) {
    if (e.code === 'forbidden') return { recipe: null, status: 'forbidden' };
    if (['unauthorized', 'signed_out', 'rate_limited', 'network'].includes(e.code)) throw e;
    return { recipe: null, status: 'error', error: e.message };
  }
}

/**
 * List the user's plugin instances that belong to a supported recipe.
 * Field fingerprints are cached per instance id (cache key includes plugin_id).
 */
export async function discoverInstances({ onProgress = () => {}, concurrency = 4 } = {}) {
  const all = await listPluginSettings();
  const cache = loadFingerprints();
  const results = [];
  let done = 0;
  let forbidden = 0;
  const queue = [...all];

  async function worker() {
    while (queue.length) {
      const ps = queue.shift();
      const cacheKey = `${ps.id}:${ps.plugin_id ?? ''}`;
      let recipeId = cache[cacheKey];
      if (recipeId === undefined) {
        const fp = await fingerprint(ps.id);
        if (fp.status === 'forbidden') forbidden++;
        recipeId = fp.recipe?.id || '';
        if (fp.status === 'ok') cache[cacheKey] = recipeId;
      }
      const recipe = recipeId ? recipeById(recipeId) : null;
      if (recipe) {
        results.push({
          id: String(ps.id),
          name: ps.name,
          pluginId: ps.plugin_id,
          // read_only? is true for recipe installs and false for the user's own (forked) plugins.
          // Both kinds accept custom field changes; the flag only drives the badge.
          installed: ps['read_only?'] === undefined ? null : !!ps['read_only?'],
          recipe,
        });
      }
      onProgress(++done, all.length);
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, all.length || 1) }, worker));
  } finally {
    saveFingerprints(cache);
  }
  results.sort((a, b) => a.name.localeCompare(b.name) || Number(a.id) - Number(b.id));
  return { instances: results, scanned: all.length, forbidden };
}

/** Verify a manually entered id belongs to a supported recipe. */
export async function probeInstance(id) {
  const inst = await readInstance(id);
  return { id: inst.id, name: inst.name || `#${inst.id}`, pluginId: null, installed: null, recipe: inst.recipe };
}
