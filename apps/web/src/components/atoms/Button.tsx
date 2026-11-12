import type { Route } from 'next';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'inverse';
export type ButtonSize = 'L' | 'M' | 'S';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-kunyit-500 text-ink hover:brightness-95',
  brand: 'bg-green-900 text-surface hover:bg-green-700',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-green-900 underline-offset-4 hover:underline',
  inverse: 'border border-surface/40 text-surface hover:bg-surface/10',
};

// Every size keeps a ≥ 44 px touch target (min-h-11), even where v0.4 drew it smaller.
const SIZE: Record<ButtonSize, string> = {
  L: 'min-h-11 px-6 py-4 text-base',
  M: 'min-h-11 px-[18px] py-3 text-sm',
  S: 'min-h-11 px-3.5 py-2 text-[13px]',
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors duration-150';

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Trailing arrow (v0.4 "Show arrow"). */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}

type AsLink = Common & { href: Route };
type AsButton = Common & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'className' | 'children'
  >;

export function Button(props: AsLink | AsButton): ReactNode {
  const { variant = 'brand', size = 'M', arrow = false, className, children } = props;
  const cls = cx(base, VARIANT[variant], SIZE[size], variant === 'ghost' && 'px-0', className);
  const content = (
    <>
      {children}
      {arrow ? <span aria-hidden="true">→</span> : null}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls}>
        {content}
      </Link>
    );
  }
  const {
    variant: _v,
    size: _s,
    arrow: _a,
    className: _c,
    children: _ch,
    href: _h,
    type = 'button',
    ...rest
  } = props;
  return (
    <button type={type} className={cls} {...rest}>
      {content}
    </button>
  );
}
