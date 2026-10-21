import { describe, expect, it } from 'vitest';

import { resolveSemanticColors } from './resolve.js';
import { buildCss } from '../scripts/build-css.js';

const { tokensCss, themeCss } = await buildCss();

/** Declarations inside the first block that starts with `opener`. */
function declarations(css: string, opener: string): Map<string, string> {
  const start = css.indexOf(opener);
  const block = css.slice(start, css.indexOf('}', start));
  const pairs = [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(
    ([, name = '', value = '']) => [name, value.trim()] as const,
  );
  return new Map(pairs);
}

function cssName(semanticName: string): string {
  return `kp-color-${semanticName.replace('.', '-')}`;
}

describe('tokens.css', () => {
  const light = declarations(tokensCss, ':root {');
  const dark = declarations(tokensCss, '[data-theme="dark"] {');
  const system = declarations(tokensCss, ':root:not([data-theme="light"]) {');

  it.each(['light', 'dark'] as const)('matches the contrast-audited values (%s)', (theme) => {
    const block = theme === 'light' ? light : dark;
    for (const [name, hex] of resolveSemanticColors(theme)) {
      expect(block.get(cssName(name)), name).toBe(hex);
    }
  });

  it('applies the same dark values for the system preference', () => {
    expect(system).toEqual(dark);
  });

  it('never exposes primitives', () => {
    expect(tokensCss).not.toMatch(/--kp-color-(green|neutral|red|blue|amber)-\d/);
  });

  it('includes scales and zeroes motion for reduced-motion users', () => {
    expect(light.get('kp-space-16')).toBe('16px');
    expect(light.get('kp-radius-lg')).toBe('12px');
    expect(tokensCss).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('theme.css (Tailwind v4)', () => {
  it('maps every semantic colour to a runtime variable without self-reference', () => {
    for (const name of resolveSemanticColors('light').keys()) {
      const themeName = name.replace('.', '-');
      expect(themeCss).toContain(`--color-${themeName}: var(--kp-color-${themeName});`);
    }
    expect(themeCss).not.toMatch(/--(color-[\w-]+): var\(--\1\)/);
  });

  it('resets Tailwind defaults so only tokens are available', () => {
    expect(themeCss).toContain('--color-*: initial;');
    expect(themeCss).toContain('--radius-lg: var(--kp-radius-lg);');
    expect(themeCss).toContain('--breakpoint-xl: 1440px;');
  });
});
