export interface TypeStyle {
  family: 'sans' | 'mono';
  weight: 400 | 500 | 600 | 700 | 800;
  sizePx: number;
  /** Unitless line height. */
  lineHeight: number;
  letterSpacingEm: number;
}

const t = (
  family: TypeStyle['family'],
  weight: TypeStyle['weight'],
  sizePx: number,
  lineHeightPct: number,
  letterSpacingPct: number,
): TypeStyle => ({
  family,
  weight,
  sizePx,
  lineHeight: lineHeightPct / 100,
  letterSpacingEm: letterSpacingPct / 100,
});

/** The 16 text styles of v0.4 (`TYPE` in lib.mjs), named `<group>-<size>`. */
export const typeScale = {
  'display-56': t('sans', 800, 56, 108, -2.5),
  'heading-h1-40': t('sans', 800, 40, 115, -2),
  'heading-h2-32': t('sans', 800, 32, 120, -2),
  'heading-h3-24': t('sans', 800, 24, 125, -1.5),
  'heading-title-20': t('sans', 800, 20, 130, -1),
  'heading-card-16': t('sans', 700, 16, 135, 0),
  'body-large-17': t('sans', 400, 17, 155, 0),
  'body-medium-15': t('sans', 400, 15, 155, 0),
  'body-small-13': t('sans', 400, 13, 150, 0),
  'label-medium-14': t('sans', 600, 14, 140, 0),
  'label-small-12': t('sans', 600, 12, 140, 0),
  'overline-11': t('sans', 700, 11, 130, 6),
  'numeric-xl-44': t('mono', 600, 44, 110, -3),
  'numeric-l-30': t('mono', 600, 30, 115, -2),
  'numeric-m-24': t('mono', 600, 24, 120, -3),
  'numeric-s-14': t('mono', 600, 14, 130, -3),
} as const satisfies Record<string, TypeStyle>;

export type TypeStyleName = keyof typeof typeScale;
