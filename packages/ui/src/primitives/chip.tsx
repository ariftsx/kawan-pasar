'use client';

import { ToggleButton, type ToggleButtonProps } from 'react-aria-components';

import { cn } from '../cn.js';
import { FOCUS_RING } from './focus.js';

import type { ReactNode } from 'react';

export type ChipProps = Omit<ToggleButtonProps, 'className' | 'children'> & {
  readonly children: ReactNode;
  readonly className?: string;
};

/**
 * A selectable pill (docs 10 §7.1); selection is announced through aria-pressed and shown with a
 * check mark plus a thicker border, never by colour alone.
 */
export function Chip({ className, children, ...props }: ChipProps) {
  return (
    <ToggleButton
      {...props}
      className={cn(
        'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-base font-semibold',
        'border-border-control bg-bg-surface text-text-primary data-[hovered]:bg-bg-subtle',
        'data-[selected]:border-border-brand data-[selected]:bg-bg-brand-subtle data-[selected]:text-text-brand',
        FOCUS_RING,
        className,
      )}
    >
      {({ isSelected }) => (
        <>
          {isSelected ? (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : null}
          {children}
        </>
      )}
    </ToggleButton>
  );
}
