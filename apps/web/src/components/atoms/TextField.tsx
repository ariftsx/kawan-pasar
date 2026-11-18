import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Labelled text input (account forms). The hint and the error are linked with
 * aria-describedby; an error also sets aria-invalid. Native control: works without JavaScript.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...rest
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>): ReactNode {
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [errorId, hintId].filter((x) => x !== undefined).join(' ');
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[14px] font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        className={cx(
          'min-h-11 w-full rounded-md border bg-surface px-3.5 py-3 text-[15px]',
          error === undefined ? 'border-line' : 'border-chili-700',
        )}
        {...(error === undefined ? {} : { 'aria-invalid': true })}
        {...(describedBy === '' ? {} : { 'aria-describedby': describedBy })}
        {...rest}
      />
      {error === undefined ? null : (
        <p id={errorId} className="text-body-small-13 font-semibold text-chili-700">
          {error}
        </p>
      )}
      {hint === undefined ? null : (
        <p id={hintId} className="text-body-small-13 text-muted-text">
          {hint}
        </p>
      )}
    </div>
  );
}
