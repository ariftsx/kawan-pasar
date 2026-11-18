import type { ReactNode } from 'react';
import type { FormState } from '@/lib/auth/form-state';
import { cx } from '@/lib/cx';

/**
 * Form-level result: errors as an alert (announced at once, focus moves here via tabIndex and
 * autoFocus after a server round trip), confirmations as a status message.
 */
export function FormMessage({ state }: { state: FormState }): ReactNode {
  if (state.status === 'idle' || state.message === undefined) return null;
  const error = state.status === 'error';
  return (
    <p
      role={error ? 'alert' : 'status'}
      tabIndex={-1}
      autoFocus
      className={cx(
        'rounded-md border px-4 py-3 text-body-medium-15 focus:outline-none',
        error ? 'border-chili-700 bg-chili-100 text-ink' : 'border-green-700 bg-green-100 text-ink',
      )}
    >
      {state.message}
    </p>
  );
}
