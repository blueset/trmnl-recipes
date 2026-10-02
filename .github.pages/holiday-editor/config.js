// TRMNL connection settings for the Holiday Editor.
//
// To enable "Connect with TRMNL", register a Developer App at https://trmnl.com/developer_apps:
//   - Redirect URIs (one per line, must match exactly):
//       https://blueset.github.io/trmnl-recipes/holiday-editor/callback.html
//       http://localhost:8080/holiday-editor/callback.html        (local development)
//   - Tick "Cannot keep a secret" (this is a static single-page app using PKCE).
// Then paste the Client ID below.

export const OAUTH = {
  clientId: 'e1ZwCNsr9iVSHLiTZGDYS1nvurLO2GoTW0aILOWcRK0',
  authorizeUrl: 'https://trmnl.com/oidc/authorize',
  tokenUrl: 'https://trmnl.com/oidc/token',
  // CORS proxy for the token endpoint: TRMNL's /oidc/token sends no CORS headers, so browsers
  // can't read it directly. Served by the `trmnl` worker in github.com/blueset/trmnl-workers (src/oidc-token).
  tokenProxyUrl: 'https://trmnl.1a23.workers.dev/oidc/token',
  scopes: ['read', 'content'],
};

export const API_BASE = 'https://trmnl.com/api';

export function redirectUri() {
  return new URL('callback.html', window.location.href).href.replace(/[?#].*$/, '');
}
