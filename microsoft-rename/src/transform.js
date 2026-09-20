const DATA_BASE_URL = "https://www.msrebrandregistry.com/";
const DAY_MS = 24 * 60 * 60 * 1000;

function parseRegistryDate(value) {
  if (typeof value !== "string") return null;

  const parts = value.split("-").map(Number);
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] || 1));
}

function durationInMonths(start, end) {
  const startDate = parseRegistryDate(start);
  const endDate = parseRegistryDate(end);
  if (!startDate || !endDate || endDate <= startDate) return 0;

  return Math.max(1, Math.round((endDate - startDate) / (DAY_MS * 30.4375)));
}

function formatDuration(totalMonths) {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];

  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months) parts.push(`${months} ${months === 1 ? "month" : "months"}`);

  return parts.join(" ") || "less than 1 month";
}

function currentPeriod(product) {
  const periods = Array.isArray(product.periods) ? product.periods : [];
  return periods.find((period) => !period.end) || periods.at(-1);
}

function selectProduct(products, mode) {
  if (mode === "recent") {
    return [...products].sort((left, right) => {
      const leftDate = parseRegistryDate(currentPeriod(left)?.start)?.getTime() || 0;
      const rightDate = parseRegistryDate(currentPeriod(right)?.start)?.getTime() || 0;
      return rightDate - leftDate || left.name.localeCompare(right.name);
    })[0];
  }

  return products[Math.floor(Math.random() * products.length)];
}

async function run(input) {
  const data = input?.IDX_0 || input;
  const products = data?.products;
  const configuredMode =
    input?.trmnl?.plugin_settings?.custom_fields_values?.type || "recent";
  const mode = String(configuredMode).toLowerCase() === "recent"
    ? "recent"
    : "random";

  if (!Array.isArray(products) || products.length === 0) {
    return {
      mode,
      error: "The Microsoft rename registry returned no products.",
    };
  }

  const product = selectProduct(products, mode);
  const periods = [...product.periods].sort((left, right) => {
    return (parseRegistryDate(left.start)?.getTime() || 0) -
      (parseRegistryDate(right.start)?.getTime() || 0);
  });
  const latest = currentPeriod({ periods });

  if (!latest?.start) {
    return {
      mode,
      error: `No current naming period was found for ${product.name}.`,
    };
  }

  const nowTimestamp = input?.trmnl?.system?.timestamp_utc;
  const now = Number.isFinite(Number(nowTimestamp))
    ? new Date(Number(nowTimestamp) * 1000)
    : new Date();
  const latestStart = parseRegistryDate(latest.start);
  const previousNames = periods
    .filter((period) => period !== latest)
    .map((period) => ({
      name: period.name,
      duration: formatDuration(durationInMonths(period.start, period.end)),
    }));

  const selectedProduct = {
    name: product.name,
    family: product.family,
    disambiguator: product.disambiguator || null,
    note: product.note || null,
    logo_url: product.logo?.src
      ? new URL(product.logo.src, DATA_BASE_URL).href
      : null,
    logo_alt: product.logo?.alt || `${product.name} logo`,
    previous_names: previousNames,
  };

  if (mode === "recent") {
    selectedProduct.days_since_rename = Math.max(
      0,
      Math.floor((now.getTime() - latestStart.getTime()) / DAY_MS)
    );
  } else {
    selectedProduct.latest_duration = formatDuration(
      durationInMonths(latest.start, now.toISOString().slice(0, 10))
    );
  }

  return { mode, product: selectedProduct };
}