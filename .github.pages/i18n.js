import { MessageFormat } from "https://cdn.jsdelivr.net/npm/messageformat@4.0.0-13/+esm";
import { DefaultFunctions, DraftFunctions } from "https://cdn.jsdelivr.net/npm/messageformat@4.0.0-13/lib/functions/+esm";

function transformDataset(dataset) {
  const params = {};
  for (const [key, value] of Object.entries(dataset)) {
    const match = key.match(/^t(.+)$/);
    if (match) {
      const rawKey = match[1];
      const newKey = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
      try {
        params[newKey] = JSON.parse(value);
      } catch {
        params[newKey] = value;
      }
    }
  }
  return params;
}

const getLocale = (() => {
  try {
    const root = script.closest(".view");
    return root.querySelector("[data-t-data]").lang || "en";
  } catch (e) {
    console.error("error getting locale", e);
    return "en";
  }
});

const getStrings = (() => {
  try {
    const root = script.closest(".view");
    return JSON.parse(root.querySelector("[data-t-data]").dataset.tData);
  } catch (e) {
    console.error("error getting translations", e);
    return {};
  }
});

function populateParts(element, parts, markups) {
  const stack = []; // Track open markup tags
  const rootChildren = []; // Children being built for current context
  const contextStack = [{ children: rootChildren }]; // Stack of contexts

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.type === 'markup') {
      const markupName = part.name;
      const markupFn = markups[markupName];

      // Ignore if markup not in markups
      if (!markupFn) continue;

      const options = part.options || {};

      if (part.kind === 'standalone') {
        // Standalone: call with empty children
        const node = markupFn(options, []);
        contextStack[contextStack.length - 1].children.push(node);
      } else if (part.kind === 'open') {
        // Open: push to stack and create new context
        const newContext = { children: [], name: markupName, options, id: part.id };
        stack.push(newContext);
        contextStack.push(newContext);
      } else if (part.kind === 'close') {
        // Close: find matching open
        let foundIndex = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].name === markupName) {
            foundIndex = j;
            break;
          }
        }

        if (foundIndex === -1) {
          // Not opened before: treat as standalone
          const node = markupFn(options, []);
          contextStack[contextStack.length - 1].children.push(node);
        } else {
          // Pop until matching opening is found
          while (stack.length > foundIndex) {
            const context = stack.pop();
            contextStack.pop();
            const parentContext = contextStack[contextStack.length - 1];
            const markupFunction = markups[context.name];
            if (markupFunction) {
              const node = markupFunction(context.options, context.children);
              parentContext.children.push(node);
            }
          }
        }
      }
    } else {
      // Non-markup part
      const p = part;
      let text = "";
      if (p.parts !== undefined) {
        for (const part2 of p.parts) {
          if (part2.value !== undefined) {
            text += String(part2.value);
          } else {
            text += String(`{${p.source}}`);
            break;
          }
        }
      } else if (p.value !== undefined) {
        text += String(p.value);
      } else {
        text += `{${p.source}}`;
      }
      const result = document.createTextNode(text);
      contextStack[contextStack.length - 1].children.push(result);
    }
  }

  // Close any unclosed tags at the end
  while (stack.length > 0) {
    const context = stack.pop();
    contextStack.pop();
    const parentContext = contextStack[contextStack.length - 1];
    const markupFunction = markups[context.name];
    if (markupFunction) {
      const node = markupFunction(context.options, context.children);
      parentContext.children.push(node);
    }
  }

  // Append all root children to element
  for (const child of rootChildren) {
    element.appendChild(child);
  }
}

function getScript(id) {  
  const script = id ? document.getElementById(id) : document.querySelector("script[data-t-script]");
  if (!script) {
    console.error("Translation script not found");
    return null;
  }
  return script;  
}

function applyPlaintext(functions = {}, options = {}) {
  const strings = getStrings();
  const locale = getLocale();
  const script = getScript(options.scriptId);
  const view = (script ?? document.body).closest(".view");
  view.querySelectorAll("[data-t]").forEach((e) => {
    try {
      const id = e.dataset.t;
      const message = strings[id] || e.innerHTML;
      const mf = new MessageFormat(locale, message, {
        functions: { ...DraftFunctions, ...functions },
      });
      e.innerText = mf.format(transformDataset(e.dataset));
    } catch (error) {
      console.error('Error formatting', e, error);
      e.innerText = error;
    }
  });
}

function applyHTML(functions = {}, markups = {}, options = {}) {
  const strings = getStrings();
  const locale = getLocale();
  const script = getScript(options.scriptId);
  const view = (script ?? document.body).closest(".view");
  view.querySelectorAll("[data-t]").forEach((e) => {
    try {
      const id = e.dataset.t;
      const message = strings[id] || e.innerHTML;
      const mf = new MessageFormat(locale, message, {
        functions: { ...DraftFunctions, ...functions },
      });
      const parts = mf.formatToParts(transformDataset(e.dataset));
      e.innerHTML = "";
      populateParts(e, parts, markups);
    } catch (error) {
      console.error('Error formatting', e, error);
      e.innerText = error;
    }
  });
}

export { 
  DefaultFunctions,
  DraftFunctions,
  applyPlaintext,
  applyHTML,
};