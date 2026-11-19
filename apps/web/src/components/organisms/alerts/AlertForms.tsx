'use client';

import type { AlertPreferences, Watch } from '@kawan-pasar/contracts/alerts';
import Link from 'next/link';
import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { IDLE } from '@/lib/auth/form-state';
import { accountHrefs } from '@/lib/hrefs';
import { Button } from '../../atoms/Button';
import { Chip } from '../../atoms/Chip';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';
import { SelectField } from '../../molecules/SelectField';
import type { FormAction } from '../auth/AuthForms';

// Forms of /peringatan (prototype d_peringatan). Plain forms with the session's CSRF token:
// they work before hydration and without JavaScript; every change reloads the page (PRG).

const Csrf = ({ value }: { value: string }): ReactNode => (
  <input type="hidden" name="csrf" value={value} />
);

const SWITCHES: readonly { name: keyof AlertPreferences; title: string; body: string }[] = [
  { name: 'inApp', title: 'Notifikasi aplikasi', body: 'Kabar muncul di halaman ini.' },
  {
    name: 'weekly',
    title: 'Ringkasan mingguan',
    body: 'Setiap Senin 06.00 WIB, di aplikasi dan email.',
  },
];
const RULES: readonly { name: keyof AlertPreferences; title: string; body: string }[] = [
  {
    name: 'unusualMove',
    title: 'Pergerakan di luar kebiasaan',
    body: 'Saat perubahan 7 hari melewati batas historis komoditas.',
  },
  {
    name: 'forecastRise',
    title: 'Prediksi naik lebih dari 2%',
    body: 'Untuk komoditas yang bisa diprediksi ARIF-Net (bukan data demo).',
  },
  {
    name: 'priceThreshold',
    title: 'Harga melewati batas saya',
    body: 'Batas per komoditas, diatur di daftar pantauan.',
  },
];

function Switch({
  name,
  title,
  body,
  checked,
}: {
  name: string;
  title: string;
  body: string;
  checked: boolean;
}): ReactNode {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-bold">{title}</span>
        <span className="text-body-small-13 text-ink-2">{body}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-1 size-5 shrink-0 accent-green-900"
      />
    </label>
  );
}

export function PreferencesForm({
  action,
  csrf,
  preferences,
  whatsappConnected,
}: {
  action: FormAction;
  csrf: string;
  preferences: AlertPreferences;
  whatsappConnected: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <p className="text-overline-11 text-muted-text uppercase">Kanal</p>
      {SWITCHES.map((s) => (
        <Switch key={s.name} {...s} checked={preferences[s.name]} />
      ))}
      {whatsappConnected ? (
        <Switch
          name="whatsapp"
          title="WhatsApp"
          body="Kabar dan ringkasan mingguan ke nomor Anda (memerlukan notifikasi aplikasi menyala). Balas STOP untuk berhenti."
          checked={preferences.whatsapp}
        />
      ) : (
        <div className="flex min-h-11 items-start justify-between gap-4">
          {/* Not connected: the switch is not offered, and the saved value is kept as it is. */}
          {preferences.whatsapp ? <input type="hidden" name="whatsapp" value="on" /> : null}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14px] font-bold">WhatsApp</span>
            <span className="text-body-small-13 text-ink-2">
              Hubungkan nomor Anda di bagian WhatsApp untuk menerima kabar lewat WhatsApp.
            </span>
          </span>
          <Chip tone="neutral" size="S">
            Belum terhubung
          </Chip>
        </div>
      )}
      <p className="text-overline-11 text-muted-text uppercase">Kapan memberi tahu</p>
      {RULES.map((s) => (
        <Switch key={s.name} {...s} checked={preferences[s.name]} />
      ))}
      <div>
        <Button type="submit" variant="brand" disabled={pending}>
          Simpan pengaturan
        </Button>
      </div>
    </form>
  );
}

const DIRECTIONS = [
  { value: 'above', label: 'Di atas' },
  { value: 'below', label: 'Di bawah' },
] as const;

function LimitFields({
  id,
  threshold,
  error,
}: {
  id: string;
  threshold: Watch['threshold'];
  error: string | undefined;
}): ReactNode {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <SelectField
        id={`${id}-direction`}
        name="direction"
        label="Arah"
        options={DIRECTIONS}
        defaultValue={threshold?.direction ?? 'above'}
      />
      <TextField
        id={`${id}-threshold`}
        name="threshold"
        label="Batas harga (Rp/kg, opsional)"
        inputMode="numeric"
        autoComplete="off"
        maxLength={16}
        defaultValue={threshold === null ? '' : threshold.thresholdIdr.toLocaleString('id-ID')}
        error={error}
      />
    </div>
  );
}

export function AddWatchForm({
  action,
  csrf,
  options,
}: {
  action: FormAction;
  csrf: string;
  options: readonly { value: string; label: string }[];
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (options.length === 0) {
    return <p className="text-body-small-13 text-ink-2">Semua komoditas sudah Anda pantau.</p>;
  }
  return (
    <form action={run} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <SelectField id="watch-commodity" name="commodity" label="Komoditas" options={options} />
      <LimitFields id="watch-new" threshold={null} error={state.fields?.['threshold']} />
      <div>
        <Button type="submit" variant="brand" disabled={pending}>
          Pantau komoditas
        </Button>
      </div>
    </form>
  );
}

export function WatchItem({
  watch,
  csrf,
  updateAction,
  removeAction,
}: {
  watch: Watch;
  csrf: string;
  updateAction: FormAction;
  removeAction: FormAction;
}): ReactNode {
  const [state, update, updating] = useActionState(updateAction, IDLE);
  const [removed, remove, removing] = useActionState(removeAction, IDLE);
  const limit =
    watch.threshold === null
      ? 'Tanpa batas harga'
      : `${watch.threshold.direction === 'above' ? 'Di atas' : 'Di bawah'} Rp ${watch.threshold.thresholdIdr.toLocaleString('id-ID')}/kg`;
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-bold">{watch.commodity.name}</span>
          <span className="text-body-small-13 text-ink-2">{limit}</span>
        </div>
        <form action={remove}>
          <Csrf value={csrf} />
          <input type="hidden" name="id" value={watch.id} />
          <Button
            type="submit"
            variant="secondary"
            size="S"
            disabled={removing}
            aria-label={`Berhenti memantau ${watch.commodity.name}`}
          >
            Hapus
          </Button>
        </form>
      </div>
      <FormMessage state={removed} />
      <details className="group">
        <summary className="min-h-11 cursor-pointer py-2 text-body-small-13 font-semibold text-green-900">
          Ubah batas harga
        </summary>
        <form action={update} className="flex flex-col gap-3 pt-2" noValidate>
          <FormMessage state={state} />
          <Csrf value={csrf} />
          <input type="hidden" name="id" value={watch.id} />
          <LimitFields
            id={`watch-${String(watch.id)}`}
            threshold={watch.threshold}
            error={state.fields?.['threshold']}
          />
          <p className="text-body-small-13 text-muted-text">Kosongkan batas untuk menghapusnya.</p>
          <div>
            <Button type="submit" variant="secondary" size="S" disabled={updating}>
              Simpan batas
            </Button>
          </div>
        </form>
      </details>
    </li>
  );
}

export function MarkAllReadForm({
  action,
  csrf,
  tab,
}: {
  action: FormAction;
  csrf: string;
  tab: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col items-end gap-2">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="tab" value={tab} />
      <Button type="submit" variant="secondary" disabled={pending}>
        Tandai semua dibaca
      </Button>
    </form>
  );
}

export function UnsubscribeForm({
  action,
  token,
}: {
  action: FormAction;
  token: string;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (state.status === 'done') return <FormMessage state={state} />;
  return (
    <form action={run} className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="brand" size="L" disabled={pending}>
        Berhenti menerima ringkasan
      </Button>
    </form>
  );
}

/** The WhatsApp channel (Fase 2C): connect with a code, see the status, disconnect. */
export function WhatsAppPanel({
  status,
  phone,
  canSendCode,
  csrf,
  sendCode,
  verify,
  disconnect,
  switchOn,
}: {
  /** The WhatsApp switch in the settings (connected but switched off sends nothing). */
  switchOn: boolean;
  status: 'none' | 'pending' | 'verified' | 'stopped';
  phone: string | null;
  canSendCode: boolean;
  csrf: string;
  sendCode: FormAction;
  verify: FormAction;
  disconnect: FormAction;
}): ReactNode {
  const [sent, runSend, sending] = useActionState(sendCode, IDLE);
  const [checked, runVerify, verifying] = useActionState(verify, IDLE);
  const [cut, runCut, cutting] = useActionState(disconnect, IDLE);
  if (phone === null) {
    return (
      <p className="text-body-small-13 text-ink-2">
        Tambahkan nomor HP di{' '}
        <Link href={accountHrefs.phone()} className="font-semibold text-green-900 underline">
          Akun saya
        </Link>{' '}
        untuk menerima kabar lewat WhatsApp.
      </p>
    );
  }
  const STATUS: Record<typeof status, string> = {
    none: 'Belum terhubung.',
    pending: 'Menunggu kode verifikasi.',
    verified: switchOn
      ? 'Terhubung. Kabar dan ringkasan mingguan juga dikirim ke WhatsApp.'
      : 'Terhubung, tetapi pengiriman WhatsApp sedang dimatikan di Pengaturan peringatan.',
    stopped: 'Dihentikan lewat balasan STOP. Verifikasi ulang untuk mengaktifkan kembali.',
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-medium-15">
        <span className="font-bold">{phone}</span> · {STATUS[status]}
      </p>
      {status === 'verified' ? (
        <form action={runCut} className="flex flex-col gap-3">
          <FormMessage state={cut} />
          <Csrf value={csrf} />
          <div>
            <Button type="submit" variant="secondary" size="S" disabled={cutting}>
              Putuskan WhatsApp
            </Button>
          </div>
        </form>
      ) : (
        <>
          <form action={runSend} className="flex flex-col gap-3">
            <FormMessage state={sent} />
            <Csrf value={csrf} />
            <div>
              <Button
                type="submit"
                variant={status === 'pending' ? 'secondary' : 'brand'}
                size="S"
                disabled={sending || !canSendCode}
              >
                {status === 'pending' ? 'Kirim ulang kode' : 'Kirim kode verifikasi'}
              </Button>
            </div>
            {canSendCode ? null : (
              <p className="text-body-small-13 text-ink-2">
                Batas pengiriman kode tercapai, atau email Anda belum terverifikasi.
              </p>
            )}
          </form>
          {status === 'pending' ? (
            <form action={runVerify} className="flex flex-col gap-3" noValidate>
              <FormMessage state={checked} />
              <Csrf value={csrf} />
              <TextField
                id="wa-code"
                name="code"
                label="Kode dari WhatsApp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={16}
                hint="6 angka, berlaku 10 menit."
                error={checked.fields?.['code']}
              />
              <div>
                <Button type="submit" variant="brand" size="S" disabled={verifying}>
                  Verifikasi
                </Button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
