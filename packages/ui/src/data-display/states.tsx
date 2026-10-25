import { cn } from '../cn.js';

import type { ReactNode } from 'react';

export type EmptyStateProps = {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong p-8 text-center',
        className,
      )}
    >
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {description === undefined ? null : (
        <p className="max-w-prose text-sm text-text-secondary">{description}</p>
      )}
      {action}
    </div>
  );
}

export type ErrorStateProps = {
  readonly title: string;
  readonly description?: string;
  /** Shown so the user can quote it; a stack trace never is (docs 10 §7.2). */
  readonly requestId?: string;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function ErrorState({ title, description, requestId, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg bg-status-error-bg p-8 text-center text-status-error-fg',
        className,
      )}
    >
      <p className="text-base font-semibold">{title}</p>
      {description === undefined ? null : <p className="text-sm">{description}</p>}
      {requestId === undefined ? null : (
        <p className="font-mono text-xs">
          Kode: <span>{requestId}</span>
        </p>
      )}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { readonly className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-bg-muted motion-reduce:animate-none', className)}
    />
  );
}
