import type { ReactNode } from 'react';

/**
 * Account (person) icon in the style of the v0.4 feature icons (24-unit artwork, 1.8 stroke,
 * duotone fill). The prototype set has none; drawn for the Fase 2A account link. Decorative.
 */
export function AccountIcon({ size = 24 }: { size?: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8.5" r="3.5" fill="var(--color-kunyit-100)" />
      <path d="M5 19.5c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5" />
    </svg>
  );
}
