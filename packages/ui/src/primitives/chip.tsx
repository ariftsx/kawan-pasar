'use client';

import { ToggleButton, type ToggleButtonProps } from 'react-aria-components';

import { cn } from '../cn.js';
import { FOCUS_RING } from './focus.js';

export type ChipProps = Omit<ToggleButtonProps, 'className'> & { readonly className?: string };

/** A selectable pill (docs 10 §7.1); selection is announced through aria-pressed. */
export function Chip({ className, ...props }: ChipProps) {
  return (
    <ToggleButton
      {...props}
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium',
        'border-border-control bg-bg-surface text-text-primary data-[hovered]:bg-bg-subtle',
        'data-[selected]:border-border-brand data-[selected]:bg-bg-brand-subtle data-[selected]:text-text-brand',
        FOCUS_RING,
        className,
      )}
    />
  );
}
