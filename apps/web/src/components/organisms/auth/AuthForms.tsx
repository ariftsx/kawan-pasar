'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/auth/form-state';
import { IDLE } from '@/lib/auth/form-state';
import { Button } from '../../atoms/Button';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';

/** A Server Action used through useActionState (works before hydration and without JS). */
export type FormAction = (state: FormState, form: FormData) => Promise<FormState>;

const PASSWORD_HINT = 'Minimal 12 karakter. Kalimat pendek yang mudah Anda ingat sudah cukup.';

function Submit({ pending, children }: { pending: boolean; children: string }): ReactNode {
  return (
    <Button type="submit" variant="brand" size="L" className="w-full" disabled={pending}>
      {children}
    </Button>
  );
}

export function LoginForm({ action, next }: { action: FormAction; next: string }): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="ke" value={next} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        defaultValue={state.values?.email}
        error={state.fields?.['email']}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Kata sandi"
        autoComplete="current-password"
        required
        maxLength={512}
        error={state.fields?.['password']}
      />
      <Submit pending={pending}>Masuk</Submit>
      <p className="text-center text-body-small-13">
        <Link href="/lupa-sandi" className="font-semibold text-green-900 underline">
          Lupa kata sandi?
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ action }: { action: FormAction }): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (state.status === 'done') return <FormMessage state={state} />;
  const consentError = state.fields?.['acceptPrivacy'];
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        defaultValue={state.values?.email}
        error={state.fields?.['email']}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Kata sandi"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint={PASSWORD_HINT}
        error={state.fields?.['password']}
      />
      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-11 items-start gap-3 text-body-medium-15">
          <input
            type="checkbox"
            name="acceptPrivacy"
            required
            className="mt-1 size-5 shrink-0 accent-green-900"
            {...(consentError === undefined
              ? {}
              : { 'aria-invalid': true, 'aria-describedby': 'acceptPrivacy-error' })}
          />
          <span>
            Saya sudah membaca dan menyetujui{' '}
            <Link href="/privasi" className="font-semibold text-green-900 underline">
              kebijakan privasi
            </Link>
            .
          </span>
        </label>
        {consentError === undefined ? null : (
          <p id="acceptPrivacy-error" className="text-body-small-13 font-semibold text-chili-700">
            {consentError}
          </p>
        )}
      </div>
      <Submit pending={pending}>Buat akun</Submit>
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: FormAction }): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (state.status === 'done') return <FormMessage state={state} />;
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        defaultValue={state.values?.email}
        error={state.fields?.['email']}
      />
      <Submit pending={pending}>Kirim tautan</Submit>
    </form>
  );
}

export function ResetPasswordForm({
  action,
  token,
}: {
  action: FormAction;
  token: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Kata sandi baru"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint={PASSWORD_HINT}
        error={state.fields?.['password']}
      />
      <Submit pending={pending}>Simpan kata sandi</Submit>
    </form>
  );
}

export function VerifyEmailForm({
  action,
  token,
}: {
  action: FormAction;
  token: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (state.status === 'done') {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage state={state} />
        <Button href="/akun" variant="brand" size="L">
          Buka akun saya
        </Button>
      </div>
    );
  }
  return (
    <form action={run} className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Submit pending={pending}>Verifikasi email saya</Submit>
    </form>
  );
}
