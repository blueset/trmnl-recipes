import * as tailwindcss from "https://esm.sh/tailwindcss@4";
import plugin from "https://esm.sh/tailwindcss/plugin";

import { createUtilities } from "./trmnl-tailwind-config.mjs";

const cssIndex = await fetch("https://esm.sh/tailwindcss@4/index.css").then(
  (response) => response.text(),
);
const cssPreflight = await fetch(
  "https://esm.sh/tailwindcss@4/preflight.css",
).then((response) => response.text());
const cssTheme = await fetch("https://esm.sh/tailwindcss@4/theme.css").then(
  (response) => response.text(),
);
const cssUtilities = await fetch(
  "https://esm.sh/tailwindcss@4/utilities.css",
).then((response) => response.text());
const trmnlShared = await fetch(
  "https://blueset.github.io/trmnl-recipes/trmnl-shared.css",
).then((response) => response.text());

const STYLE_TYPE = "text/tailwindcss";
let compiler;
const classes = new Set();
let lastCss = "";
const outputStylesheet = document.createElement("style");
let buildQueue = Promise.resolve();

async function createCompiler() {
  const stylesheets = document.querySelectorAll(`style[type="${STYLE_TYPE}"]`);

  let css = "";
  for (const stylesheet of stylesheets) {
    observeSheet(stylesheet);
    css += stylesheet.textContent + "\n";
  }

  if (!css.includes("@import")) {
    css = `@import "tailwindcss";${css}`;
  }

  // The input CSS did not change so the compiler does not need to be recreated
  if (lastCss === css) return;

  lastCss = css;
  compiler = await tailwindcss.compile(css, {
    base: "/",
    loadStylesheet,
    loadModule,
  });

  classes.clear();
}

async function loadStylesheet(id, base) {
  switch (id) {
    case "tailwindcss":
      return {
        path: "virtual:tailwindcss/index.css",
        base,
        content: cssIndex,
      };
    case "tailwindcss/preflight":
    case "tailwindcss/preflight.css":
    case "./preflight.css":
      return {
        path: "virtual:tailwindcss/preflight.css",
        base,
        content: cssPreflight,
      };
    case "tailwindcss/theme":
    case "tailwindcss/theme.css":
    case "./theme.css":
      return {
        path: "virtual:tailwindcss/theme.css",
        base,
        content: cssTheme,
      };
    case "tailwindcss/utilities":
    case "tailwindcss/utilities.css":
    case "./utilities.css":
      return {
        path: "virtual:tailwindcss/utilities.css",
        base,
        content: cssUtilities,
      };
    case "trmnl-shared":
    case "trmnl-shared.css":
    case "./trmnl-shared.css":
      return {
        path: "virtual:trmnl-shared.css",
        base,
        content: trmnlShared,
      };
    default:
      throw new Error(`The browser build does not support @import for "${id}"`);
  }
}

async function loadModule(id, base) {
  if (id === "trmnl-plugin") {
    return {
      path: "virtual:trmnl-plugin/index.js",
      base,
      module: plugin(function ({ addUtilities }) {
        addUtilities(createUtilities());
      }),
    };
  }
}

async function build(kind) {
  if (!compiler) return;

  // 1. Refresh the known list of classes
  const newClasses = new Set();

  for (const element of document.querySelectorAll("[class]")) {
    for (const className of element.classList) {
      if (classes.has(className)) continue;

      classes.add(className);
      newClasses.add(className);
    }
  }

  if (newClasses.size === 0 && kind === "incremental") return;

  // 2. Compile the CSS

  outputStylesheet.textContent = compiler.build(Array.from(newClasses));
}

function rebuild(kind) {
  async function run() {
    if (!compiler && kind !== "full") {
      return;
    }

    if (kind === "full") {
      await createCompiler();
    }

    await build(kind);
  }

  buildQueue = buildQueue.then(run);
}

// Handle changes to known stylesheets
const styleObserver = new MutationObserver(() => rebuild("full"));

function observeSheet(sheet) {
  styleObserver.observe(sheet, {
    attributes: true,
    attributeFilter: ["type"],
    characterData: true,
    subtree: true,
    childList: true,
  });
}

// Handle changes to the document that could affect the styles
// - Changes to any element's class attribute
// - New stylesheets being added to the page
// - New elements (with classes) being added to the page
new MutationObserver((records) => {
  let full = 0;
  let incremental = 0;

  for (const record of records) {
    // New stylesheets == tracking + full rebuild
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName !== "STYLE") continue;
      if (node.getAttribute("type") !== STYLE_TYPE) continue;

      observeSheet(node);
      full++;
    }

    // New nodes require an incremental rebuild
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      // Skip the output stylesheet itself to prevent loops
      if (node === outputStylesheet) continue;

      incremental++;
    }

    // Changes to class attributes require an incremental rebuild
    if (record.type === "attributes") {
      incremental++;
    }
  }

  if (full > 0) {
    return rebuild("full");
  } else if (incremental > 0) {
    return rebuild("incremental");
  }
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
  childList: true,
  subtree: true,
});

rebuild("full");

document.head.append(outputStylesheet);
