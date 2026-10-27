'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import {
  Button as AriaButton,
  Link as AriaLink,
  type ButtonProps as AriaButtonProps,
  type LinkProps as AriaLinkProps,
} from 'react-aria-components';

import { cn } from '../cn.js';
import { FOCUS_RING } from './focus.js';

export const buttonStyles = cva(
  cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap',
    'transition-colors duration-150 select-none cursor-pointer',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[pending]:cursor-progress',
    FOCUS_RING,
  ),
  {
    variants: {
      variant: {
        primary: 'bg-bg-brand text-text-on-brand data-[hovered]:bg-bg-brand-hover',
        secondary:
          'bg-bg-surface text-text-primary border border-border-control data-[hovered]:bg-bg-subtle',
        ghost: 'text-text-brand data-[hovered]:bg-bg-brand-subtle',
        danger: 'bg-status-error-bg text-status-error-fg border border-status-error-fg',
      },
      // Older users first: md is 48 px, lg 56 px for the one main action on a screen, and sm never
      // goes under the 44 px touch-target minimum (docs 09 §8).
      size: {
        lg: 'min-h-14 px-6 text-lg',
        md: 'min-h-12 px-5 text-base',
        sm: 'min-h-11 px-4 text-sm',
      },
      isFullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Variants = VariantProps<typeof buttonStyles>;

export type ButtonProps = Omit<AriaButtonProps, 'className'> &
  Variants & { readonly className?: string };

export function Button({ variant, size, isFullWidth, className, ...props }: ButtonProps) {
  return (
    <AriaButton {...props} className={buttonStyles({ variant, size, isFullWidth, className })} />
  );
}

export type ButtonLinkProps = Omit<AriaLinkProps, 'className'> &
  Variants & { readonly className?: string };

/** Navigation that looks like a button; it stays a real link for assistive technology. */
export function ButtonLink({ variant, size, isFullWidth, className, ...props }: ButtonLinkProps) {
  return (
    <AriaLink {...props} className={buttonStyles({ variant, size, isFullWidth, className })} />
  );
}
