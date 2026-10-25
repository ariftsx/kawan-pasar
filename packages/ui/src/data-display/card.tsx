import { cn } from '../cn.js';

import type { ComponentPropsWithoutRef } from 'react';

export type CardProps = ComponentPropsWithoutRef<'section'>;

/** Surface for one block of content (docs 10 §5: radius/lg, elevation on hover only). */
export function Card({ className, ...props }: CardProps) {
  return (
    <section
      {...props}
      className={cn('rounded-lg border border-border-default bg-bg-surface p-4 md:p-6', className)}
    />
  );
}
