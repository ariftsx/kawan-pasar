import { colors } from './colors.js';
import { motion } from './motion.js';
import { breakpoints, radius } from './space.js';
import { typeScale } from './typography.js';

export { colors, TEXT_PAIRS, TEXT_PAIRS_FORBIDDEN, type ColorName } from './colors.js';
export { contrastRatio } from './contrast.js';
export { motion } from './motion.js';
export { breakpoints, contentMaxPx, radius, space } from './space.js';
export { typeScale, type TypeStyle, type TypeStyleName } from './typography.js';

/**
 * Tailwind 4 `@theme` block generated from the tokens above, so CSS and TypeScript share one
 * source. Fonts are provided by next/font as `--font-jakarta` / `--font-geist-mono`.
 */
export function themeCss(): string {
  // Drop Tailwind's default palette: only Brand v0.4 colours exist in the app.
  const lines: string[] = ['  --color-*: initial;'];
  for (const [name, hex] of Object.entries(colors)) lines.push(`  --color-${name}: ${hex};`);
  lines.push('  --font-sans: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;');
  lines.push('  --font-mono: var(--font-geist-mono), ui-monospace, monospace;');
  for (const [name, s] of Object.entries(typeScale)) {
    lines.push(`  --text-${name}: ${String(s.sizePx / 16)}rem;`);
    lines.push(`  --text-${name}--line-height: ${String(s.lineHeight)};`);
    lines.push(`  --text-${name}--letter-spacing: ${String(s.letterSpacingEm)}em;`);
    lines.push(`  --text-${name}--font-weight: ${String(s.weight)};`);
  }
  for (const [name, px] of Object.entries(radius))
    lines.push(`  --radius-${name}: ${String(px)}px;`);
  for (const [name, px] of Object.entries(breakpoints)) {
    lines.push(`  --breakpoint-${name}: ${String(px)}px;`);
  }
  lines.push(`  --ease-kp: cubic-bezier(0.22, 1, 0.36, 1);`);
  for (const [name, ms] of Object.entries(motion)) lines.push(`  --kp-${name}: ${String(ms)}ms;`);
  return `@theme {\n${lines.join('\n')}\n}\n`;
}
