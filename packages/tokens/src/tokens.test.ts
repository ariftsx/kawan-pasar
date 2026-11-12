import { describe, expect, it } from 'vitest';
import {
  TEXT_PAIRS,
  TEXT_PAIRS_FORBIDDEN,
  colors,
  contrastRatio,
  motion,
  themeCss,
  typeScale,
} from './index.js';

describe('colors', () => {
  it('keeps the Brand v0.4 palette exactly', () => {
    expect(colors.ink).toBe('#14201A');
    expect(colors.canvas).toBe('#FAF7F0');
    expect(colors['green-900']).toBe('#0E4D35');
    expect(colors['chili-600']).toBe('#E04535');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it.each(TEXT_PAIRS)('%s on %s reaches its required ratio', (fg, bg, kind) => {
    const min = kind === 'normal' ? 4.5 : 3;
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });

  it.each(TEXT_PAIRS_FORBIDDEN)('%s on %s really fails AA for small text', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeLessThan(4.5);
  });
});

describe('typeScale and motion', () => {
  it('uses the mono family for numeric styles', () => {
    expect(typeScale['numeric-m-24'].family).toBe('mono');
    expect(typeScale['heading-h1-40'].sizePx).toBe(40);
  });

  it('keeps the v0.4 motion guide timings', () => {
    expect(motion).toMatchObject({ kapaBobMs: 900, kapaBlinkMs: 140, kapaCycleMs: 3200 });
  });
});

describe('themeCss', () => {
  it('emits a Tailwind 4 theme block from the same source', () => {
    const css = themeCss();
    expect(css).toMatch(/^@theme \{/);
    expect(css).toContain('--color-green-900: #0E4D35;');
    expect(css).toContain('--radius-xl: 24px;');
    expect(css).toContain('--breakpoint-lg: 1024px;');
  });
});
