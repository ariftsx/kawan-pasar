'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { IDLE } from '@/lib/auth/form-state';
import { Button } from '../../atoms/Button';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';
import type { FormAction } from '../auth/AuthForms';

/** Analyst role request on /akun (Fase 3A). */
export function AnalystRequestForm({
  action,
  csrf,
}: {
  action: FormAction;
  csrf: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (state.status === 'done') return <FormMessage state={state} />;
  const error = state.fields?.['reason'];
  return (
    <form action={run} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="csrf" value={csrf} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="analyst-reason" className="text-[14px] font-semibold">
          Untuk apa data ini?
        </label>
        <textarea
          id="analyst-reason"
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          defaultValue={state.values?.reason ?? ''}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={
            error === undefined ? 'analyst-reason-hint' : 'analyst-reason-error analyst-reason-hint'
          }
          className="rounded-md border border-line bg-surface px-3 py-2 text-[15px]"
        />
        {error === undefined ? null : (
          <p id="analyst-reason-error" className="text-body-small-13 text-chili-700">
            {error}
          </p>
        )}
        <p id="analyst-reason-hint" className="text-body-small-13 text-muted-text">
          Contoh: skripsi tentang inflasi pangan, kajian TPID. 10–500 karakter.
        </p>
      </div>
      <TextField
        id="analyst-organization"
        name="organization"
        label="Instansi (opsional)"
        maxLength={120}
        defaultValue={state.values?.organization ?? ''}
      />
      <div>
        <Button type="submit" variant="secondary" size="S" disabled={pending}>
          Ajukan peran Analis
        </Button>
      </div>
    </form>
  );
}
