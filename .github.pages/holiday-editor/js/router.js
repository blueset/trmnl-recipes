// Minimal hash router with async navigation guards.

const { reactive } = Vue;

export function parseHash(hash = location.hash) {
  const path = decodeURIComponent(String(hash).replace(/^#\/?/, ''));
  const [head, ...rest] = path.split('/');
  switch (head) {
    case 'manual': return { name: 'manual', params: {} };
    case 'reference': return { name: 'reference', params: {} };
    case 'trmnl': return rest[0] ? { name: 'trmnl', params: { id: rest[0] } } : { name: 'trmnl', params: {} };
    default: return { name: 'home', params: {} };
  }
}

export const route = reactive({ ...parseHash(), hash: location.hash });

// Guards return (or resolve to) false to cancel navigation.
const guards = new Set();
export function addGuard(fn) {
  guards.add(fn);
  return () => guards.delete(fn);
}

async function runGuards(to, from) {
  for (const g of [...guards]) {
    if ((await g(to, from)) === false) return false;
  }
  return true;
}

let navSeq = 0;
window.addEventListener('hashchange', async (e) => {
  const fromHash = route.hash;
  const to = { ...parseHash(location.hash), hash: location.hash };
  const from = { name: route.name, params: route.params, hash: fromHash };
  if (to.name === from.name && to.params.id === from.params.id) {
    route.hash = location.hash;
    return;
  }
  const mySeq = ++navSeq;
  const ok = await runGuards(to, from);
  if (mySeq !== navSeq) return;
  if (!ok) {
    history.replaceState(null, '', fromHash || location.pathname + location.search);
    return;
  }
  Object.assign(route, to);
  if (to.name !== 'reference') window.scrollTo(0, 0);
});

export function navigate(hash, { replace = false } = {}) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (replace) {
    history.replaceState(null, '', target);
    Object.assign(route, { ...parseHash(target), hash: target });
  } else {
    location.hash = target;
  }
}
