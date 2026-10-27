import { cn } from '@kawan-pasar/ui';

import { Bakul, type BakulPose } from './bakul';

import type { ReactNode } from 'react';

/**
 * Si Bakul with a speech bubble. The bubble is ordinary text, so screen readers read it in place;
 * the drawing itself is decorative. Give it a new `key` to replay the pop-in when the text changes.
 */
export function BakulSays({
  pose = 'rest',
  size = 'md',
  isAnimated = false,
  children,
  className,
}: {
  readonly pose?: BakulPose;
  /** `lg` for the landing hero. */
  readonly size?: 'md' | 'lg';
  readonly isAnimated?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <Bakul
        pose={pose}
        isAnimated={isAnimated}
        className={cn('shrink-0', size === 'lg' ? 'w-24 md:w-52' : 'w-24 md:w-28')}
      />
      <div className="relative mb-6 rounded-xl border-2 border-border-default bg-bg-surface px-4 py-3 text-lg leading-snug motion-safe:animate-pop-in">
        <span
          aria-hidden="true"
          className="absolute bottom-4 -left-2 size-4 rotate-45 border-b-2 border-l-2 border-border-default bg-bg-surface"
        />
        {children}
      </div>
    </div>
  );
}
