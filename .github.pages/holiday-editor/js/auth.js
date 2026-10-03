// Authentication for the TRMNL API: OAuth 2 authorization code + PKCE, or an account API key.
// Session (tokens) lives in localStorage; the PKCE verifier/state live in sessionStorage
// for the duration of the redirect round-trip.

import { OAUTH, redirectUri } from '../config.js';

const SESSION_KEY = 'trmnl-holiday-editor:session';
const PKCE_KEY = 'trmnl-holiday-editor:pkce';
const REFRESH_LOCK = 'trmnl-holiday-editor:refresh';
const EXPIRY_SKEW_MS = 60_000;

export class AuthError extends Error {
  constructor(message, { code = 'auth_error', cause } = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.cause = cause;
  }
}

const listeners = new Set();

/** @returns {null | { type: 'oauth'|'apikey', accessToken: string, refreshToken?: string, expiresAt?: number, scope?: string }} */
export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return s && s.accessToken ? s : null;
  } catch {
    return null;
  }
}

function setSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  for (const cb of listeners) cb(getSession());
}

export function onSessionChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Keep tabs in sync (sign-out or refresh in another tab).
window.addEventListener('storage', (e) => {
  if (e.key === SESSION_KEY) for (const cb of listeners) cb(getSession());
});

export const isOAuthConfigured = () => !!OAUTH.clientId;

export function grantedScopes() {
  const s = getSession();
  if (!s) return [];
  if (s.type === 'apikey') return ['read', 'content'];
  return String(s.scope || OAUTH.scopes.join(' ')).split(/\s+/).filter(Boolean);
}

// ─── PKCE helpers ───

function base64Url(bytes) {
  let str = '';
  for (const b of new Uint8Array(bytes)) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength = 48) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function s256(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(digest);
}

/** Redirect to TRMNL’s consent screen. `returnHash` is restored after the callback. */
export async function beginOAuth(returnHash = '#trmnl') {
  if (!isOAuthConfigured()) throw new AuthError('OAuth is not configured for this site.', { code: 'not_configured' });
  const verifier = randomString(48);
  const state = randomString(24);
  const redirect = redirectUri();
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, redirect, returnHash, createdAt: Date.now() }));
  const url = new URL(OAUTH.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH.clientId,
    redirect_uri: redirect,
    scope: OAUTH.scopes.join(' '),
    state,
    code_challenge: await s256(verifier),
    code_challenge_method: 'S256',
  }).toString();
  window.location.assign(url.toString());
}

async function postToken(params) {
  // Never retry a code exchange against a second endpoint: the first request may already
  // have consumed the single-use code even if the browser couldn't read the response.
  const endpoint = OAUTH.tokenProxyUrl || OAUTH.tokenUrl;
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (cause) {
    throw new AuthError(
      OAUTH.tokenProxyUrl
        ? 'Could not reach the token proxy.'
        : "The browser could not read TRMNL’s token response (likely blocked by CORS). Configure a token proxy or sign in with an API key.",
      { code: 'network', cause },
    );
  }
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok || !body?.access_token) {
    throw new AuthError(body?.error_description || body?.error || `Token request failed (HTTP ${res.status}).`, {
      code: body?.error || `http_${res.status}`,
    });
  }
  return body;
}

function sessionFromTokenResponse(body) {
  return {
    type: 'oauth',
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: Date.now() + (Number(body.expires_in) || 7200) * 1000,
    scope: body.scope || OAUTH.scopes.join(' '),
  };
}

/**
 * Handle the OAuth redirect (called from callback.html).
 * @returns {Promise<string>} the hash to return to.
 */
export async function completeOAuth(search = window.location.search) {
  const params = new URLSearchParams(search);
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch {}
  sessionStorage.removeItem(PKCE_KEY);

  if (params.get('error')) {
    throw new AuthError(params.get('error_description') || params.get('error'), { code: params.get('error') });
  }
  if (!pending) throw new AuthError('Sign-in session expired or was started in another tab. Please try again.', { code: 'no_pending' });
  if (!params.get('state') || params.get('state') !== pending.state) {
    throw new AuthError('Sign-in state mismatch. Please try again.', { code: 'state_mismatch' });
  }
  const code = params.get('code');
  if (!code) throw new AuthError('No authorization code returned.', { code: 'no_code' });

  const body = await postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: pending.redirect,
    client_id: OAUTH.clientId,
    code_verifier: pending.verifier,
  });
  setSession(sessionFromTokenResponse(body));
  return pending.returnHash || '#trmnl';
}

export function signInWithApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) throw new AuthError('Enter an API key.', { code: 'empty' });
  setSession({ type: 'apikey', accessToken: key });
}

export function signOut() {
  setSession(null);
}

let refreshInFlight = null;

/**
 * Refresh the access token. Serialized across tabs with the Web Locks API when available.
 * Pass `staleToken` (the token that was rejected) to force a refresh unless another tab already replaced it.
 */
export function refreshSession({ staleToken = null } = {}) {
  if (refreshInFlight) return refreshInFlight;
  const run = async () => {
    const current = getSession();
    if (!current || current.type !== 'oauth' || !current.refreshToken) {
      throw new AuthError('Your TRMNL session has expired. Please sign in again.', { code: 'expired' });
    }
    // Another tab may have refreshed while we waited for the lock.
    if (staleToken ? current.accessToken !== staleToken : current.expiresAt - Date.now() > EXPIRY_SKEW_MS) return current;
    try {
      const body = await postToken({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: OAUTH.clientId,
      });
      const next = sessionFromTokenResponse(body);
      if (!next.refreshToken) next.refreshToken = current.refreshToken;
      setSession(next);
      return next;
    } catch (e) {
      if (e.code === 'invalid_grant') {
        setSession(null);
        throw new AuthError('Your TRMNL session has expired or was revoked. Please sign in again.', { code: 'expired' });
      }
      throw e;
    }
  };
  const locked = navigator.locks?.request ? () => navigator.locks.request(REFRESH_LOCK, run) : run;
  refreshInFlight = locked().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

/** A usable access token, refreshing first when it is about to expire. */
export async function getAccessToken() {
  const s = getSession();
  if (!s) return null;
  if (s.type === 'oauth' && s.expiresAt && s.expiresAt - Date.now() < EXPIRY_SKEW_MS) {
    return (await refreshSession()).accessToken;
  }
  return s.accessToken;
}
