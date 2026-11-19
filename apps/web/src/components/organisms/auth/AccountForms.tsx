'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { IDLE } from '@/lib/auth/form-state';
import { Button } from '../../atoms/Button';
import { PasswordField } from '../../atoms/PasswordField';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';
import type { FormAction } from './AuthForms';
import { PHONE_HINT } from './AuthForms';

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
      <PasswordField
        id="current"
        name="current"
        label="Kata sandi saat ini"
        autoComplete="current-password"
        required
        maxLength={512}
        error={state.fields?.['current']}
      />
      <PasswordField
        id="next"
        name="next"
        label="Kata sandi baru"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint="Minimal 12 karakter. Sesi di perangkat lain akan dikeluarkan."
        error={state.fields?.['next']}
      />
      <PasswordField
        id="nextConfirm"
        name="nextConfirm"
        label="Ulangi kata sandi baru"
        autoComplete="new-password"
        required
        maxLength={128}
        error={state.fields?.['nextConfirm']}
      />
      <div>
        <Button type="submit" variant="brand" disabled={pending}>
          Ganti kata sandi
        </Button>
      </div>
    </form>
  );
}

/** The optional mobile number: shown masked, replaced by typing a new one, or removed. */
export function PhoneForms({
  setAction,
  removeAction,
  csrf,
  masked,
}: {
  setAction: FormAction;
  removeAction: FormAction;
  csrf: string;
  masked: string | null;
}): ReactNode {
  const [state, run, pending] = useActionState(setAction, IDLE);
  const [removed, remove, removing] = useActionState(removeAction, IDLE);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-medium-15">{masked ?? 'Belum ada nomor HP.'}</p>
      <form action={run} className="flex flex-col gap-4" noValidate>
        <FormMessage state={state} />
        <Csrf value={csrf} />
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={masked === null ? 'Nomor HP' : 'Nomor HP baru'}
          autoComplete="tel"
          inputMode="tel"
          required
          maxLength={32}
          defaultValue={state.values?.phone}
          hint={PHONE_HINT}
          error={state.fields?.['phone']}
        />
        <div>
          <Button type="submit" variant="brand" disabled={pending}>
            Simpan nomor HP
          </Button>
        </div>
      </form>
      {masked === null ? null : (
        <form action={remove} className="flex flex-col gap-3">
          <FormMessage state={removed} />
          <Csrf value={csrf} />
          <div>
            <Button type="submit" variant="secondary" size="S" disabled={removing}>
              Hapus nomor HP
            </Button>
          </div>
        </form>
      )}
    </div>
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
      <PasswordField
        id="delete-password"
        name="password"
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
