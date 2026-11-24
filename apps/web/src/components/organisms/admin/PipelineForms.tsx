'use client';

import { useActionState, useId } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/auth/form-state';
import { IDLE } from '@/lib/auth/form-state';
import { Button } from '../../atoms/Button';
import { FormMessage } from '../../molecules/FormMessage';
import type { FormAction } from '../auth/AuthForms';
import { ConfirmField, Csrf } from './AdminForms';

// Fase 4C: the pipeline (Airflow through the Core API) and the model audit. Every change asks for
// the admin's password inline when no confirmation is open, like the forms of Fase 3B.

/** Trigger, pause or resume one DAG. */
export function PipelineControl({
  action,
  csrf,
  dag,
  paused,
  confirmed,
  triggerLabel,
  triggerDisabled,
}: {
  action: FormAction;
  csrf: string;
  dag: 'harga_harian' | 'latih_ulang';
  paused: boolean;
  confirmed: boolean;
  triggerLabel: string;
  triggerDisabled: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="dag" value={dag} />
      <ConfirmField show={!confirmed} state={state} />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="op"
          value="trigger"
          size="S"
          disabled={pending || triggerDisabled}
        >
          {triggerLabel}
        </Button>
        <Button
          type="submit"
          name="op"
          value={paused ? 'resume' : 'pause'}
          variant="secondary"
          size="S"
          disabled={pending}
        >
          {paused ? 'Lanjutkan jadwal' : 'Jeda jadwal'}
        </Button>
      </div>
    </form>
  );
}

export function ScheduleForm({
  action,
  csrf,
  current,
  options,
  confirmed,
}: {
  action: FormAction;
  csrf: string;
  current: string;
  options: readonly (readonly [string, string])[];
  confirmed: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  const id = useId();
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[14px] font-semibold">
          Jadwal latih ulang ARIF-Net
        </label>
        <select
          id={id}
          name="preset"
          defaultValue={current}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-[15px]"
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <ConfirmField show={!confirmed} state={state} />
      <div>
        <Button type="submit" size="S" disabled={pending}>
          Simpan jadwal
        </Button>
      </div>
    </form>
  );
}

export function CandidateDecisionForm({
  action,
  csrf,
  id,
  confirmed,
  approvable,
}: {
  action: FormAction;
  csrf: string;
  id: number;
  confirmed: boolean;
  approvable: boolean;
}): ReactNode {
  const [state, run, pending]: [FormState, (f: FormData) => void, boolean] = useActionState(
    action,
    IDLE,
  );
  const noteId = useId();
  const noteError = state.fields?.['note'];
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-[14px] font-semibold">
          Alasan penolakan (wajib bila menolak)
        </label>
        <textarea
          id={noteId}
          name="note"
          maxLength={500}
          rows={3}
          defaultValue={state.values?.note ?? ''}
          aria-invalid={noteError === undefined ? undefined : true}
          aria-describedby={noteError === undefined ? undefined : `${noteId}-error`}
          className="rounded-md border border-line bg-surface px-3 py-2 text-[15px]"
        />
        {noteError === undefined ? null : (
          <p id={`${noteId}-error`} className="text-[13px] text-chili-700">
            {noteError}
          </p>
        )}
      </div>
      {approvable ? null : (
        <p className="text-[14px] text-ink-2">
          Belum bisa disetujui: lihat gerbang audit di atas. Kandidat tetap bisa ditolak.
        </p>
      )}
      <ConfirmField show={!confirmed} state={state} />
      <div className="flex flex-wrap gap-3">
        {approvable ? (
          <Button type="submit" name="decision" value="approve" size="S" disabled={pending}>
            Setujui dan aktifkan
          </Button>
        ) : null}
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="secondary"
          size="S"
          disabled={pending}
        >
          Tolak
        </Button>
      </div>
    </form>
  );
}
