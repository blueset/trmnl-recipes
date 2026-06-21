async function transform(input) {
  const url =
    "https://www.google.com/intl/en_ALL/ipv6/statistics/data/adoption.js";

  // Prefer the polling response body; fall back to fetching the source.
  let text =
    typeof input === "string"
      ? input
      : (input && (input.body || input.data)) || "";
  if (!text || text.indexOf("googleIPv6AdoptionData") === -1) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching IPv6 adoption data`);
    }
    text = await res.text();
  }

  // Extract the array literal from `var googleIPv6AdoptionData = [ ... ];`.
  const match = text.match(/=\s*(\[[\s\S]*\])\s*;/);
  if (!match) {
    throw new Error("Could not parse IPv6 adoption data");
  }

  // Each row: [year, month (0-11), day, total IPv6 %, non-relayed IPv6 %].
  const raw = JSON.parse(match[1]);
  if (!raw.length) {
    throw new Error("IPv6 adoption data is empty");
  }

  const data = raw.map((row) => row[3]);
  const startDate = raw[0].slice(0, 3);
  const endDate = raw[raw.length - 1].slice(0, 3);
  const n = data.length;

  // Latest adoption percentage.
  const current = Math.round(data[n - 1] * 1e6) / 1e6;

  // Split the headline so the templates can de-emphasise the decimals,
  // e.g. 48<small>.680841%</small>.
  const currentParts = current.toString().split(".");
  const currentWhole = currentParts[0];
  const currentFraction =
    currentParts.length > 1 ? "." + currentParts[1] + "%" : "%";

  // Trend: delta from mean(previous 7 days) to mean(recent 7 days).
  const mean = (arr) => arr.reduce((sum, x) => sum + x, 0) / arr.length;
  const recent = data.slice(Math.max(0, n - 7));
  const previous = data.slice(Math.max(0, n - 14), Math.max(0, n - 7));
  const trendRaw = previous.length ? mean(recent) - mean(previous) : 0;
  const trend = Math.round(trendRaw * 100) / 100;
  const trendUp = trendRaw >= 0;
  const trendAbs = Math.abs(trend);

  // Smooth the noisy daily readings into monthly averages for charting.
  const DAY = 86400000;
  const startMs = Date.UTC(startDate[0], startDate[1], startDate[2]);
  const buckets = {};
  const order = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(startMs + i * DAY);
    const key = d.getUTCFullYear() + "-" + d.getUTCMonth();
    if (!buckets[key]) {
      buckets[key] = {
        sum: 0,
        count: 0,
        ts: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15),
      };
      order.push(key);
    }
    buckets[key].sum += data[i];
    buckets[key].count += 1;
  }
  const series = order.map((k) => [
    buckets[k].ts,
    Math.round((buckets[k].sum / buckets[k].count) * 100) / 100,
  ]);

  // Y axis ceiling rounded up to the nearest 5%.
  let maxValue = 0;
  for (const point of series) {
    if (point[1] > maxValue) maxValue = point[1];
  }
  const yMax = Math.max(5, Math.ceil(maxValue / 5) * 5);

  // End date formatted as YYYY-MM-DD (month is zero-based in the source).
  const pad = (x) => (x < 10 ? "0" + x : "" + x);
  const endLabel =
    endDate[0] + "-" + pad(endDate[1] + 1) + "-" + pad(endDate[2]);

  return {
    startDate,
    endDate,
    // data,
    current,
    currentWhole,
    currentFraction,
    trend,
    trendAbs,
    trendUp,
    series,
    yMax,
    endLabel,
  };
}

if (require.main === module) {
  (async () => {
    const result = await transform({});
    console.log(
      JSON.stringify(
        {
          startDate: result.startDate,
          endDate: result.endDate,
          current: result.current,
          trend: result.trend,
          trendUp: result.trendUp,
          yMax: result.yMax,
          endLabel: result.endLabel,
          seriesPoints: result.series.length,
          lastSeries: result.series.slice(-3),
        },
        null,
        2
      )
    );
  })();
}