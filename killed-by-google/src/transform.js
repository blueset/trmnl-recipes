const TIME_ZONE = "America/Los_Angeles";
const ONE_MONTH_DAYS = 30;

const FUTURE_IDIOMS = [
  "Sentenced to death",
  "“Off with their heads!”",
  "Kicking the bucket",
  "Dead as a doorknob",
  "Done for",
  "Expiring",
  "Biting the big one",
  "Off to the glue factory",
  "Another one bites the dust",
  "To be turned off",
  "Like a fork stuck in the outlet",
  "Scheduled to be killed",
  "To be exterminated",
  "To be flushed",
  "Getting unplugged",
  "Vanishing",
  "Going poof",
  "Turning to ashes",
  "Getting KO’d",
  "Running out of juice",
  "Fading into darkness",
  "Floating belly up",
];

function pollingData(input) {
  if (Array.isArray(input?.IDX_0)) return input.IDX_0;
  if (Array.isArray(input?.data)) return input.data;
  return Array.isArray(input) ? input : null;
}

function currentTime(input) {
  const timestamp = input?.trmnl?.system?.timestamp_utc;
  const numericTimestamp = Number(timestamp);

  if (Number.isFinite(numericTimestamp) && numericTimestamp > 0) {
    return new Date(
      numericTimestamp > 1_000_000_000_000
        ? numericTimestamp
        : numericTimestamp * 1000
    );
  }

  if (typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp))) {
    return new Date(timestamp);
  }

  return new Date();
}

function dateKeyInTimeZone(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseDate(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ));

  return Number.isNaN(date.getTime()) ? null : date;
}

function dayDifference(left, right) {
  return Math.abs(Math.round((left.getTime() - right.getTime()) / 86_400_000));
}

function formatDistanceDays(days) {
  if (days < 1) return "less than a day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 45) return "about 1 month";
  if (days < 320) return `${Math.round(days / 30.4375)} months`;
  if (days < 548) return "about 1 year";

  const years = days / 365.2425;
  const roundedYears = Math.round(years);
  return `about ${roundedYears} ${roundedYears === 1 ? "year" : "years"}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function configuredMode(input) {
  const value =
    input?.trmnl?.plugin_settings?.custom_fields_values?.type ||
    "upcoming";
  const normalized = String(value).trim().toLowerCase();

  return [
    "recently_announced",
    "upcoming",
    "recently_killed",
    "random",
  ].includes(normalized)
    ? normalized
    : "upcoming";
}

function byCloseAscending(left, right) {
  return left.dateClose.localeCompare(right.dateClose) ||
    left.name.localeCompare(right.name);
}

function byCloseDescending(left, right) {
  return right.dateClose.localeCompare(left.dateClose) ||
    left.name.localeCompare(right.name);
}

function selectProduct(products, mode, today) {
  const valid = products.filter((product) => {
    return product &&
      typeof product.name === "string" &&
      parseDate(product.dateOpen) &&
      parseDate(product.dateClose);
  });

  if (mode === "recently_announced") {
    return [...valid].sort(byCloseDescending)[0];
  }

  if (mode === "recently_killed") {
    return valid
      .filter((product) => product.dateClose <= today)
      .sort(byCloseDescending)[0];
  }

  if (mode === "upcoming") {
    const upcoming = valid
      .filter((product) => product.dateClose >= today)
      .sort(byCloseAscending)[0];

    return upcoming || valid
      .filter((product) => product.dateClose <= today)
      .sort(byCloseDescending)[0];
  }

  return valid[Math.floor(Math.random() * valid.length)];
}

function futureLead(relativeDate) {
  const seed = [...relativeDate].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

  return `${FUTURE_IDIOMS[seed % FUTURE_IDIOMS.length]} in ${relativeDate}, `;
}

function displayProduct(product, today) {
  const openDate = parseDate(product.dateOpen);
  const closeDate = parseDate(product.dateClose);
  const todayDate = parseDate(today);
  const future = product.dateClose > today;
  const distanceFromToday = formatDistanceDays(dayDifference(closeDate, todayDate));
  const lifespan = formatDistanceDays(dayDifference(closeDate, openDate));
  const recentlyKilled =
    !future && dayDifference(closeDate, todayDate) < ONE_MONTH_DAYS;
  const lead = future
    ? futureLead(distanceFromToday)
    : recentlyKilled
      ? "Killed recently, "
      : `Killed ${distanceFromToday} ago, `;
  const yearsLine = future
    ? ` It will be ${lifespan} old.`
    : ` It was ${lifespan} old.`;

  return {
    name: product.name,
    is_long_name: product.name.length > 24,
    type: product.type || "product",
    date_open: product.dateOpen,
    date_close: product.dateClose,
    date_open_display: formatDate(openDate),
    date_close_display: future
      ? `(${formatDate(closeDate)})`
      : formatDate(closeDate),
    year_open: String(openDate.getUTCFullYear()),
    year_close: future
      ? `(${closeDate.getUTCFullYear()})`
      : String(closeDate.getUTCFullYear()),
    description: product.description || "",
    description_line: `${lead}${product.description || ""}${yearsLine}`,
    lifespan,
    is_future: future,
    status_label: future ? "Scheduled departure" : "Resting in the Google graveyard",
  };
}

async function run(input) {
  const products = pollingData(input);
  const mode = configuredMode(input);

  if (!products || products.length === 0) {
    return {
      mode,
      mode_label: mode.replace(/\b\w/g, (letter) => letter.toUpperCase()).replaceAll("_", " "),
      error: "The Google graveyard returned no products.",
    };
  }

  const today = dateKeyInTimeZone(currentTime(input));
  const product = selectProduct(products, mode, today);

  if (!product) {
    return {
      mode,
      mode_label: mode.replace(/\b\w/g, (letter) => letter.toUpperCase()).replaceAll("_", " "),
      error: "No graveyard entry matched this display option.",
    };
  }

  return {
    mode,
    mode_label: mode.replace(/\b\w/g, (letter) => letter.toUpperCase()).replaceAll("_", " "),
    today,
    time_zone: TIME_ZONE,
    product: displayProduct(product, today),
  };
}