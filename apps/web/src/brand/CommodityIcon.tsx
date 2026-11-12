import type { CommodityCode } from '@kawan-pasar/catalog';
import type { ReactNode } from 'react';
import { COMMODITY_ICONS } from './data/commodity-icons';

/** Coloured commodity icon (48-unit artwork). Decorative: the commodity name is always shown. */
export function CommodityIcon({
  code,
  size = 48,
}: {
  code: CommodityCode;
  size?: number;
}): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {COMMODITY_ICONS[code]}
    </svg>
  );
}
