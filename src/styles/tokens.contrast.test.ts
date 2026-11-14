// Guards the colour tokens: any palette change (including a full restyle) must
// keep text readable and control outlines visible in both themes.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const css = readFileSync('src/styles/app.css', 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text-dim', 'bg', 4.5],
  ['text-dim', 'surface', 4.5],
  ['text-dim', 'surface-2', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['on-accent', 'accent', 4.5],
  ['income', 'surface', 4.5],
  ['income', 'income-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['border-strong', 'surface', 3],
  ['border-strong', 'bg', 3],
];

const light = tokens(":root[data-theme='light']");
const dark = tokens(":root[data-theme='dark']");

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme tokens', (_name, theme) => {
  test.each(PAIRS)('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(theme[fg], `--${fg} missing`).toBeDefined();
    expect(theme[bg], `--${bg} missing`).toBeDefined();
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(min);
  });
});

test('the system-dark block matches the forced dark theme', () => {
  expect(tokens(':root:not([data-theme])')).toEqual(dark);
});
