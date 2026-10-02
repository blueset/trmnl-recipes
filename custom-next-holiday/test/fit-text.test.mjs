import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/shared.liquid', import.meta.url), 'utf8');
const fittingSource = source.slice(
  source.indexOf('  function textOverflows()'),
  source.indexOf('  let fitFrame;'),
);

function fixture({ width = 460, height = 730, textWidth = 400, textHeight = 138, overhang = 10 } = {}) {
  const baseFontSize = 38;
  const style = { removeProperty() { delete this.fontSize; } };
  const scale = () => parseFloat(style.fontSize ?? baseFontSize) / baseFontSize;
  const parentRect = { left: 0, right: width, top: 0, bottom: height };
  const textRect = () => ({
    left: 0,
    right: width,
    top: (height - textHeight * scale()) / 2,
    bottom: (height + textHeight * scale()) / 2,
  });
  const contentRect = () => ({
    ...textRect(),
    bottom: textRect().bottom + overhang * scale(),
  });
  const textContainer = {
    style,
    parentElement: { getBoundingClientRect: () => parentRect },
    getBoundingClientRect: textRect,
    clientWidth: width,
    get scrollWidth() { return Math.max(width, Math.round(textWidth * scale())); },
    get clientHeight() { return Math.round(textHeight * scale()); },
    get scrollHeight() { return Math.round((textHeight + overhang) * scale()); },
  };
  const document = {
    createRange: () => ({
      selectNodeContents(node) { assert.equal(node, textContainer); },
      getBoundingClientRect: contentRect,
    }),
  };
  const getComputedStyle = () => ({ fontSize: `${baseFontSize}px` });
  const { fitText, textOverflows } = new Function(
    'textContainer', 'document', 'getComputedStyle',
    `${fittingSource}\nreturn { fitText, textOverflows };`,
  )(textContainer, document, getComputedStyle);
  return { fitText, textOverflows, textContainer, parentRect, scale };
}

test('portrait line-box overhang does not shrink text that fits in the layout', () => {
  const { fitText, textOverflows, textContainer, scale } = fixture();
  assert.ok(textContainer.scrollHeight > textContainer.clientHeight + 1);
  assert.equal(textOverflows(), false);
  fitText();
  assert.equal(scale(), 1);
});

test('horizontal overflow still shrinks to the largest fitting size', () => {
  const { fitText, textOverflows, textContainer, scale } = fixture({ textWidth: 800 });
  assert.equal(textOverflows(), true);
  fitText();
  assert.equal(textOverflows(), false);
  assert.ok(scale() > 0.57 && scale() < 0.58);
  textContainer.style.fontSize = `${38 * (scale() + 0.001)}px`;
  assert.equal(textOverflows(), true);
});

test('actual content below the layout shrinks even when the text box itself fits', () => {
  const { fitText, textOverflows, scale } = fixture({ height: 150 });
  assert.equal(textOverflows(), true);
  fitText();
  assert.equal(textOverflows(), false);
  assert.ok(scale() > 0.95 && scale() < 0.97);
});

test('content above the layout is detected independently of scroll height', () => {
  const { textOverflows, parentRect } = fixture({ overhang: 0 });
  parentRect.top = 300;
  assert.equal(textOverflows(), true);
});

test('fitting restores the base font after more space becomes available', () => {
  const { fitText, parentRect, scale } = fixture({ height: 150 });
  fitText();
  assert.ok(scale() < 1);
  parentRect.bottom = 730;
  fitText();
  assert.equal(scale(), 1);
});

test('font size retains the existing quarter-size lower bound', () => {
  const { fitText, textOverflows, scale } = fixture({ textWidth: 4000 });
  fitText();
  assert.equal(scale(), 0.25);
  assert.equal(textOverflows(), true);
});
