'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { IDLE } from '@/lib/auth/form-state';
import { Button } from '../../atoms/Button';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';
import type { FormAction } from './AuthForms';

// Forms of /akun. Each carries the session's CSRF token (synchronizer token, design Fase 2 §3).

const Csrf = ({ value }: { value: string }): ReactNode => (
  <input type="hidden" name="csrf" value={value} />
);

export function ChangePasswordForm({
  action,
  csrf,
}: {
  action: FormAction;
  csrf: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <TextField
        id="current"
        name="current"
        type="password"
        label="Kata sandi saat ini"
        autoComplete="current-password"
        required
        maxLength={512}
        error={state.fields?.['current']}
      />
      <TextField
        id="next"
        name="next"
        type="password"
        label="Kata sandi baru"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint="Minimal 12 karakter. Sesi di perangkat lain akan dikeluarkan."
        error={state.fields?.['next']}
      />
      <div>
        <Button type="submit" variant="brand" disabled={pending}>
          Ganti kata sandi
        </Button>
      </div>
    </form>
  );
}

export function ResendVerificationForm({
  action,
  csrf,
}: {
  action: FormAction;
  csrf: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <div>
        <Button type="submit" variant="secondary" size="S" disabled={pending}>
          Kirim ulang tautan verifikasi
        </Button>
      </div>
    </form>
  );
}

export function RevokeSessionForm({
  action,
  csrf,
  id,
  device,
}: {
  action: FormAction;
  csrf: string;
  id: string;
  device: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col items-end gap-2">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="secondary"
        size="S"
        disabled={pending}
        aria-label={`Keluarkan sesi ${device}`}
      >
        Keluarkan
      </Button>
    </form>
  );
}

export function DeleteAccountForm({
  action,
  csrf,
}: {
  action: FormAction;
  csrf: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <TextField
        id="delete-password"
        name="password"
        type="password"
        label="Kata sandi"
        autoComplete="current-password"
        required
        maxLength={512}
        hint="Akun, sesi, dan pengaturan Anda dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        error={state.fields?.['password']}
      />
      <div>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="border-chili-700 text-chili-700"
        >
          Hapus akun saya
        </Button>
      </div>
    </form>
  );
}
