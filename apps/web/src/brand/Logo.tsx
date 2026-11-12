import type { ReactNode } from 'react';
import { LOGO_MARK, LOGO_MARK_INVERSE } from './data/logo-marks';

export interface LogoProps {
  variant?: 'horizontal' | 'mark';
  tone?: 'default' | 'inverse';
  /** Height of the mark in px (v0.4 minimum: 24). */
  size?: number;
}

/** Kawan Pasar logo: a market basket with a rising price line and a forecast dot (v0.4). */
export function Logo({
  variant = 'horizontal',
  tone = 'default',
  size = 40,
}: LogoProps): ReactNode {
  const px = Math.max(24, size);
  const mark = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {tone === 'inverse' ? LOGO_MARK_INVERSE : LOGO_MARK}
    </svg>
  );
  if (variant === 'mark') {
    return (
      <span role="img" aria-label="Kawan Pasar" className="inline-flex shrink-0">
        {mark}
      </span>
    );
  }
  return (
    <span role="img" aria-label="Kawan Pasar" className="inline-flex shrink-0 items-center gap-2.5">
      {mark}
      <span
        aria-hidden="true"
        className={`leading-none font-extrabold tracking-[-0.03em] ${tone === 'inverse' ? 'text-canvas' : 'text-green-900'}`}
        style={{ fontSize: Math.round(px * 0.6) }}
      >
        kawan pasar
      </span>
    </span>
  );
}
