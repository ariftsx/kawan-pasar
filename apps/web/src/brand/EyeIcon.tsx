import type { ReactNode } from 'react';

/**
 * Eye icon for the show-password button, in the style of AccountIcon (24-unit artwork, 1.8
 * stroke). `open`: the password is hidden and can be shown; otherwise the eye is struck
 * through. Decorative: the button carries the accessible name.
 */
export function EyeIcon({ open, size = 24 }: { open: boolean; size?: number }): ReactNode {
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
      <path d="M2.5 12c2.2-4 5.4-6 9.5-6s7.3 2 9.5 6c-2.2 4-5.4 6-9.5 6s-7.3-2-9.5-6Z" />
      <circle cx="12" cy="12" r="3" fill="var(--color-kunyit-100)" />
      {open ? null : <path d="M4 4l16 16" />}
    </svg>
  );
}
