async function transform(input) {
  const trmnl = input.trmnl;
  const tz = trmnl.user.time_zone_iana;
  const timestampUtc = new Date().getTime() / 1000;
  const vendors = trmnl.plugin_settings.custom_fields_values.vendors || [];

  const dateStr = resolveMenuDate(timestampUtc, tz);
  const todayStr = tzDateStr(timestampUtc, tz);
  const dateLabel = dateStr === todayStr ? 'Today' : 'Next Monday';

  const menus = await Promise.all(
    vendors.map(async (vendor) => {
      const url = `https://dining.frozor.io/api/dining/menu/${vendor}?date=${dateStr}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          return { vendor, date: dateStr, error: `HTTP ${res.status}` };
        }
        const data = await res.json();
        return { vendor, date: dateStr, data };
      } catch (e) {
        return { vendor, date: dateStr, error: String(e) };
      }
    })
  );

  const cutoff = dateMinusDays(dateStr, 14);

  return {
    date: dateStr,
    dateLabel,
    menus: filterMenus(menus, cutoff),
  };
}

// Applies the menu filtering rules. `cutoff` is the yyyy-mm-dd boundary; items
// whose firstAppearance is older than this are considered stale.
// Each menu's `data` is a Station[] array.
function filterMenus(menus, cutoff) {
  return menus
    // Drop cafes that failed to fetch or returned no station list.
    .filter((m) => Array.isArray(m.data))
    .map((m) => {
      const stations = m.data
        // Drop stations with no theme, no recently available items, and not traveling.
        .filter((st) => {
          const u = st.uniqueness || {};
          const hasTheme = Array.isArray(u.themeItemIds) && u.themeItemIds.length > 0;
          return hasTheme || u.recentlyAvailableItemCount || u.isTraveling;
        })
        .map((st) => {
          const themeIds = (st.uniqueness && st.uniqueness.themeItemIds) || [];
          const menu = {};
          for (const [category, items] of Object.entries(st.menu || {})) {
            menu[category] = items
              // Keep theme items and items first seen within the cutoff window.
              .filter(
                (item) =>
                  themeIds.includes(item.id) ||
                  !item.firstAppearance ||
                  item.firstAppearance >= cutoff
              )
              // Strip bulky fields the template doesn't need.
              .map(({ modifiers, searchTags, ...rest }) => rest);
          }
          return { ...st, menu };
        });
      return { ...m, data: stations };
    })
    .filter((m) => m.data.length > 0);
}

// Returns today's yyyy-mm-dd as seen in the given timezone.
function tzDateStr(timestampUtc, timeZone) {
  const now = new Date(timestampUtc * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

// Returns the yyyy-mm-dd that is `days` before the given yyyy-mm-dd date.
function dateMinusDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Returns the yyyy-mm-dd to request: today's date in the given timezone if it
// is Mon–Fri, otherwise the upcoming Monday.
function resolveMenuDate(timestampUtc, timeZone) {
  const now = new Date(timestampUtc * 1000);

  // Calendar date (Y/M/D) as seen in the target timezone.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);

  // Anchor at UTC noon so day arithmetic is DST-safe.
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const dow = date.getUTCDay(); // 0 = Sunday, 6 = Saturday

  if (dow === 6) date.setUTCDate(date.getUTCDate() + 2); // Sat -> Mon
  else if (dow === 0) date.setUTCDate(date.getUTCDate() + 1); // Sun -> Mon

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

if (require.main === module) {
  (async () => {
    const input = {
      trmnl: {
        user: { time_zone_iana: 'America/Los_Angeles' },
        system: { timestamp_utc: 1781914412 },
        plugin_settings: {
          custom_fields_values: { vendors: ['foodhall4', 'bobae'] },
        },
      },
    };
    const result = await transform(input);
    console.log(JSON.stringify(result, null, 2));
  })();
}