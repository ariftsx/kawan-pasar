import { cn } from '@kawan-pasar/ui';
import Link from 'next/link';

import { Kapa, type KapaPose } from '@/components/brand/kapa';
import { formatChangeArrow } from '@/lib/format';

import type { Route } from 'next';
import type { ReactNode } from 'react';

// Building blocks of the v0.4 screens. Direction is always carried by an arrow and a sign, never
// by colour alone (WCAG 1.4.1).

export const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

export function Overline({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <p className={cn('text-xs font-bold tracking-wider text-text-muted uppercase', className)}>
      {children}
    </p>
  );
}

export function PageHeader({
  overline,
  title,
  description,
  aside,
}: {
  readonly overline: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-3xl flex-col gap-2">
        <Overline className="text-text-brand">{overline}</Overline>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        {description === undefined ? null : (
          <div className="text-lg text-text-secondary">{description}</div>
        )}
      </div>
      {aside}
    </header>
  );
}

export type ChipTone = 'brand' | 'forecast' | 'highlight' | 'chili' | 'neutral' | 'outline';

const CHIP: Record<ChipTone, string> = {
  brand: 'bg-status-available-bg text-status-available-fg',
  forecast: 'bg-accent-forecast-bg text-accent-forecast-fg',
  highlight: 'bg-accent-highlight-bg text-accent-highlight-fg',
  chili: 'bg-accent-chili-bg text-accent-chili-fg',
  neutral: 'bg-bg-muted text-text-secondary',
  outline: 'border border-border-default text-text-secondary',
};

export function StatusChip({
  tone,
  children,
  className,
}: {
  readonly tone: ChipTone;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
        CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Change with arrow and sign; up is red, down is blue (docs 10 §3.2), flat is neutral. */
export function ChangeTag({
  ratio,
  className,
}: {
  readonly ratio: number | null;
  readonly className?: string;
}) {
  const tone =
    ratio === null || Math.abs(ratio) < 0.0005
      ? 'bg-bg-muted text-text-secondary'
      : ratio > 0
        ? 'bg-status-up-bg text-status-up-fg'
        : 'bg-status-down-bg text-status-down-fg';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-sm font-semibold whitespace-nowrap',
        tone,
        className,
      )}
    >
      {formatChangeArrow(ratio)}
    </span>
  );
}

export type Segment = { readonly href: Route; readonly label: string; readonly isActive: boolean };

/** Server-rendered segmented control: plain links, so it works before any JavaScript loads. */
export function SegmentedLinks({
  label,
  items,
  className,
}: {
  readonly label: string;
  readonly items: readonly Segment[];
  readonly className?: string;
}) {
  return (
    <nav aria-label={label} className={cn('max-w-full overflow-x-auto', className)}>
      <ul className="inline-flex gap-1 rounded-full bg-bg-muted p-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              scroll={false}
              {...(item.isActive ? { 'aria-current': 'true' as const } : {})}
              className={cn(
                'flex min-h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap',
                item.isActive
                  ? 'bg-bg-surface text-text-primary shadow-1'
                  : 'text-text-secondary hover:text-text-primary',
                FOCUS,
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SectionHeader({
  id,
  title,
  description,
  link,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly link?: { readonly href: Route; readonly label: string };
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="text-base text-text-secondary">{description}</p>
        )}
      </div>
      {link === undefined ? null : <TextLink href={link.href}>{link.label}</TextLink>}
    </div>
  );
}

export function TextLink({
  href,
  children,
  className,
}: {
  readonly href: Route;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-text-brand underline-offset-4 hover:underline',
        FOCUS,
        className,
      )}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** "Kata Kapa": a short, non-advisory explanation next to the data. */
export function KataKapa({
  pose,
  title,
  children,
  link,
  className,
}: {
  readonly pose: KapaPose;
  readonly title: string;
  readonly children: ReactNode;
  readonly link?: { readonly href: Route; readonly label: string };
  readonly className?: string;
}) {
  return (
    <aside
      className={cn(
        'flex gap-4 rounded-3xl bg-accent-highlight-bg p-6 text-text-primary',
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-2">
        <StatusChip tone="highlight" className="self-start bg-bg-surface">
          Kata Kapa
        </StatusChip>
        <p className="text-lg font-bold">{title}</p>
        <div className="text-base text-text-secondary">{children}</div>
        {link === undefined ? null : <TextLink href={link.href}>{link.label}</TextLink>}
      </div>
      <Kapa pose={pose} className="w-16 shrink-0 self-end sm:w-24 md:w-28" />
    </aside>
  );
}

export function Surface({
  children,
  className,
  ...props
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly 'aria-labelledby'?: string;
}) {
  return (
    <section
      {...props}
      className={cn('rounded-3xl border border-border-default bg-bg-surface p-6', className)}
    >
      {children}
    </section>
  );
}

export function Bullets({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base text-text-secondary">
          <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-muted" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
