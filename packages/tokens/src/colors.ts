/**
 * Brand v0.4 palette, copied exactly from the prototype (`figcraft-Kawan_Pasar/lib.mjs`).
 *
 * The three `*-text` / `*-700` entries are NOT in v0.4. They exist because some v0.4 colours
 * fail WCAG AA when used for small text (see TEXT_PAIRS_FORBIDDEN). The original colours stay
 * for fills, lines and large text; the darker ones are used only for small text.
 */
export const colors = {
  canvas: '#FAF7F0',
  surface: '#FFFFFF',
  'surface-2': '#F3EFE6',
  ink: '#14201A',
  'ink-2': '#4A5750',
  muted: '#7C877F',
  line: '#E8E2D6',
  'green-900': '#0E4D35',
  'green-600': '#17865A',
  'green-100': '#E3F2E9',
  'chili-600': '#E04535',
  'chili-100': '#FDE7E3',
  'kunyit-500': '#F0A92E',
  'kunyit-100': '#FDF1D8',
  'terong-600': '#6A4BD6',
  'terong-100': '#EEE9FD',
  'shallot-500': '#B8325E',
  // Accessible text variants (not in v0.4).
  'muted-text': '#5F6B63',
  'green-700': '#127048',
  'chili-700': '#B23628',
} as const;

export type ColorName = keyof typeof colors;

type Kind = 'normal' | 'large';

/** Foreground/background pairs the UI uses for text, with the size class they are used at. */
export const TEXT_PAIRS: readonly (readonly [ColorName, ColorName, Kind])[] = [
  ['ink', 'canvas', 'normal'],
  ['ink', 'surface', 'normal'],
  ['ink-2', 'canvas', 'normal'],
  ['ink-2', 'surface', 'normal'],
  ['muted-text', 'canvas', 'normal'],
  ['muted-text', 'surface', 'normal'],
  ['muted-text', 'surface-2', 'normal'],
  ['green-900', 'surface', 'normal'],
  ['green-900', 'green-100', 'normal'],
  ['green-700', 'green-100', 'normal'],
  ['chili-700', 'chili-100', 'normal'],
  ['chili-700', 'surface', 'normal'],
  ['terong-600', 'terong-100', 'normal'],
  ['terong-600', 'surface', 'normal'],
  ['ink', 'kunyit-500', 'normal'],
  ['ink', 'kunyit-100', 'normal'],
  ['surface', 'green-900', 'normal'],
  ['canvas', 'green-900', 'normal'],
  ['kunyit-500', 'green-900', 'normal'],
  ['shallot-500', 'surface', 'normal'],
  // Large text / icons only.
  ['muted', 'surface', 'large'],
  ['green-600', 'surface', 'large'],
  ['chili-600', 'surface', 'large'],
];

/** v0.4 pairs that must never carry small text (they fail 4.5:1). */
export const TEXT_PAIRS_FORBIDDEN: readonly (readonly [ColorName, ColorName])[] = [
  ['muted', 'canvas'],
  ['muted', 'surface'],
  ['green-600', 'green-100'],
  ['chili-600', 'chili-100'],
  ['chili-600', 'surface'],
];
