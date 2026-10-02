const key = 'trmnl-holiday-editor:theme';
const media = matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  try { return localStorage.getItem(key) || 'dark'; }
  catch { return 'dark'; }
}

export function applyTheme(preference) {
  document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
}

export function saveTheme(preference) {
  applyTheme(preference);
  try { localStorage.setItem(key, preference); }
  catch (error) { console.warn('Could not store theme preference.', error); }
}

media.addEventListener('change', () => {
  if (getTheme() === 'system') applyTheme('system');
});
applyTheme(getTheme());
