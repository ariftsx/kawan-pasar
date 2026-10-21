// WCAG 2.x contrast ratio and the registered pairs that CI must keep above threshold
// (docs 10 §3.3, docs 11 §8).
import { THEMES, resolveSemanticColors, type Theme } from './resolve.js';

const HEX = /^#[0-9a-f]{6}$/i;

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.039_28 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Expected #rrggbb, got ${hex}`);
  const int = Number.parseInt(hex.slice(1), 16);
  const red = channel((int >> 16) & 0xff);
  const green = channel((int >> 8) & 0xff);
  const blue = channel(int & 0xff);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 4.5 for text, 3 for non-text UI parts and graphics (WCAG 1.4.3 / 1.4.11). */
export type ContrastPair = { readonly fg: string; readonly bg: string; readonly min: 3 | 4.5 };

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: 'text.primary', bg: 'bg.surface', min: 4.5 },
  { fg: 'text.primary', bg: 'bg.canvas', min: 4.5 },
  { fg: 'text.secondary', bg: 'bg.surface', min: 4.5 },
  { fg: 'text.muted', bg: 'bg.surface', min: 4.5 },
  { fg: 'text.muted', bg: 'bg.subtle', min: 4.5 },
  { fg: 'text.brand', bg: 'bg.surface', min: 4.5 },
  { fg: 'text.on-brand', bg: 'bg.brand', min: 4.5 },
  { fg: 'text.inverse', bg: 'bg.inverse', min: 4.5 },
  { fg: 'status.up-fg', bg: 'status.up-bg', min: 4.5 },
  { fg: 'status.down-fg', bg: 'status.down-bg', min: 4.5 },
  { fg: 'status.available-fg', bg: 'status.available-bg', min: 4.5 },
  { fg: 'status.partial-fg', bg: 'status.partial-bg', min: 4.5 },
  { fg: 'status.missing-fg', bg: 'status.missing-bg', min: 4.5 },
  { fg: 'status.error-fg', bg: 'status.error-bg', min: 4.5 },
  { fg: 'status.info-fg', bg: 'status.info-bg', min: 4.5 },
  { fg: 'demo.fg', bg: 'demo.bg', min: 4.5 },
  { fg: 'chart.forecast', bg: 'bg.surface', min: 3 },
  { fg: 'chart.observed', bg: 'bg.surface', min: 3 },
  { fg: 'border.control', bg: 'bg.surface', min: 3 },
  { fg: 'border.focus', bg: 'bg.surface', min: 3 },
];

export type ContrastResult = ContrastPair & { readonly theme: Theme; readonly ratio: number };

/** Every registered pair in both themes; callers fail when `ratio < min`. */
export function auditContrast(pairs: readonly ContrastPair[] = CONTRAST_PAIRS): ContrastResult[] {
  return THEMES.flatMap((theme) => {
    const colors = resolveSemanticColors(theme);
    return pairs.map((pair) => {
      const fg = colors.get(pair.fg);
      const bg = colors.get(pair.bg);
      if (fg === undefined || bg === undefined) {
        throw new Error(`Unknown token in pair ${pair.fg} / ${pair.bg}`);
      }
      return { ...pair, theme, ratio: contrastRatio(fg, bg) };
    });
  });
}
