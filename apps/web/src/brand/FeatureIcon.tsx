import type { ReactNode } from 'react';
import { FEATURE_ICONS } from './data/feature-icons';
import type { FeatureIconName } from './data/feature-icons';

export type { FeatureIconName } from './data/feature-icons';

/** Duotone feature icon (24-unit artwork, 1.8 stroke). Decorative: pair it with a text label. */
export function FeatureIcon({
  name,
  size = 24,
}: {
  name: FeatureIconName;
  size?: number;
}): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {FEATURE_ICONS[name]}
    </svg>
  );
}
