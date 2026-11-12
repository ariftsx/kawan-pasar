import type { ReactNode } from 'react';
import { ILLUSTRATIONS } from './data/illustrations-data';
import type { IllustrationName } from './data/illustrations-data';

export type { IllustrationName } from './data/illustrations-data';

/** Decorative vector illustration; scales to the width of its container. */
export function Illustration({
  name,
  className,
}: {
  name: IllustrationName;
  className?: string;
}): ReactNode {
  const ill = ILLUSTRATIONS[name];
  return (
    <svg
      viewBox={ill.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={['h-auto w-full', className].filter(Boolean).join(' ')}
    >
      {ill.body}
    </svg>
  );
}
