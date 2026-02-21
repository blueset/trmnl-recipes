import * as tailwindcss from "https://esm.sh/tailwindcss@4";
import plugin from "https://esm.sh/tailwindcss/plugin";
const cssIndex = await fetch("https://esm.sh/tailwindcss@4/index.css").then(
  (res) => res.text(),
);
const cssPreflight = await fetch(
  "https://esm.sh/tailwindcss@4/preflight.css",
).then((res) => res.text());
const cssTheme = await fetch("https://esm.sh/tailwindcss@4/theme.css").then(
  (res) => res.text(),
);
const cssUtilities = await fetch(
  "https://esm.sh/tailwindcss@4/utilities.css",
).then((res) => res.text());

const STYLE_TYPE = "text/tailwindcss";
let compiler;
let classes = new Set();
let lastCss = "";
let sheet = document.createElement("style");
let buildQueue = Promise.resolve();
async function createCompiler() {
  let stylesheets = document.querySelectorAll(`style[type="${STYLE_TYPE}"]`);

  let css = "";
  for (let sheet of stylesheets) {
    observeSheet(sheet);
    css += sheet.textContent + "\n";
  }

  if (!css.includes("@import")) {
    css = `@import "tailwindcss";${css}`;
  }

  // The input CSS did not change so the compiler does not need to be recreated
  if (lastCss === css) return;

  lastCss = css;

  try {
    compiler = await tailwindcss.compile(css, {
      base: "/",
      loadStylesheet,
      loadModule,
    });
  } finally {
  }

  classes.clear();
}

async function loadStylesheet(id, base) {
  function load() {
    if (id === "tailwindcss") {
      return {
        path: "virtual:tailwindcss/index.css",
        base,
        content: cssIndex,
      };
    } else if (
      id === "tailwindcss/preflight" ||
      id === "tailwindcss/preflight.css" ||
      id === "./preflight.css"
    ) {
      return {
        path: "virtual:tailwindcss/preflight.css",
        base,
        content: cssPreflight,
      };
    } else if (
      id === "tailwindcss/theme" ||
      id === "tailwindcss/theme.css" ||
      id === "./theme.css"
    ) {
      return {
        path: "virtual:tailwindcss/theme.css",
        base,
        content: cssTheme,
      };
    } else if (
      id === "tailwindcss/utilities" ||
      id === "tailwindcss/utilities.css" ||
      id === "./utilities.css"
    ) {
      return {
        path: "virtual:tailwindcss/utilities.css",
        base,
        content: cssUtilities,
      };
    }

    throw new Error(`The browser build does not support @import for "${id}"`);
  }

  try {
    let sheet = load();
    return sheet;
  } catch (err) {
    throw err;
  }
}

async function loadModule(id, base) {
  if (id === "trmnl-plugin") {
    return {
      path: "virtual:trmnl-plugin/index.js",
      base,
      module: plugin(function ({ addUtilities }) {
        const utilityGroups = [
          {
            name: "content",
            varPrefix: "richtext",
            variants: [
              "small",
              "base",
              "large",
              "xlarge",
              "xxlarge",
              "xxxlarge",
            ],
          },
          {
            name: "description",
            varPrefix: "description",
            variants: ["base", "large", "xlarge"],
          },
        ];

        const utilities = {};
        for (const { name, varPrefix, variants } of utilityGroups) {
          for (const variant of variants) {
            const infix = variant === "base" ? "" : `-${variant}`;
            utilities[`.${name}-${variant}`] = {
              "font-family": `var(--${varPrefix}${infix}-font-family)`,
              "font-size": `var(--${varPrefix}${infix}-font-size)`,
              "line-height": `var(--${varPrefix}${infix}-line-height)`,
              "font-weight": `var(--font-weight-${name}-${variant})`,
              "-webkit-font-smoothing": `var(--${varPrefix}${infix}-font-smoothing)`,
            };
          }
        }
        addUtilities(utilities);
      }),
    };
  }
}

async function build(kind) {
  if (!compiler) return;

  // 1. Refresh the known list of classes
  let newClasses = new Set();

  for (let element of document.querySelectorAll("[class]")) {
    for (let c of element.classList) {
      if (classes.has(c)) continue;

      classes.add(c);
      newClasses.add(c);
    }
  }

  if (newClasses.size === 0 && kind === "incremental") return;

  // 2. Compile the CSS

  sheet.textContent = compiler.build(Array.from(newClasses));
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
let styleObserver = new MutationObserver(() => rebuild("full"));

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

  for (let record of records) {
    // New stylesheets == tracking + full rebuild
    for (let node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName !== "STYLE") continue;
      if (node.getAttribute("type") !== STYLE_TYPE) continue;

      observeSheet(node);
      full++;
    }

    // New nodes require an incremental rebuild
    for (let node of record.addedNodes) {
      if (node.nodeType !== 1) continue;

      // Skip the output stylesheet itself to prevent loops
      if (node === sheet) continue;

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

document.head.append(sheet);
