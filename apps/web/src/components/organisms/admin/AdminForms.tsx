'use client';

import { useActionState, useId } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/auth/form-state';
import { IDLE } from '@/lib/auth/form-state';
import { Button } from '../../atoms/Button';
import { PasswordField } from '../../atoms/PasswordField';
import { TextField } from '../../atoms/TextField';
import { FormMessage } from '../../molecules/FormMessage';
import type { FormAction } from '../auth/AuthForms';

const CATEGORIES = [
  ['dasar', 'Dasar'],
  ['prediksi', 'Prediksi'],
  ['arif-net', 'ARIF-Net'],
  ['keterbatasan', 'Keterbatasan'],
] as const;

const ROLE = { user: 'Pengguna', analyst: 'Analis', admin: 'Admin' } as Record<string, string>;

const Csrf = ({ value }: { value: string }): ReactNode => (
  <input type="hidden" name="csrf" value={value} />
);

/**
 * The admin's password, asked inline when no confirmation is open (or the API asked again), so a
 * change is never lost to a separate confirmation page.
 */
function ConfirmField({ show, state }: { show: boolean; state: FormState }): ReactNode {
  const id = useId();
  // Asked again by the API wins; a confirmation made by this form's last submit stops asking.
  if (state.needsConfirm !== true && (!show || state.confirmedNow === true)) return null;
  return (
    <PasswordField
      id={`${id}-password`}
      name="adminPassword"
      label="Kata sandi Anda (konfirmasi)"
      autoComplete="current-password"
      required
      hint="Perubahan oleh admin perlu konfirmasi kata sandi. Berlaku 10 menit."
    />
  );
}

export function DecisionForm({
  action,
  csrf,
  id,
  confirmed,
}: {
  action: FormAction;
  csrf: string;
  id: number;
  confirmed: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  const noteId = useId();
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-[14px] font-semibold">
          Catatan untuk pengaju (opsional, tampil bila ditolak)
        </label>
        <textarea
          id={noteId}
          name="note"
          maxLength={500}
          rows={2}
          defaultValue={state.values?.note ?? ''}
          className="rounded-md border border-line bg-surface px-3 py-2 text-[15px]"
        />
      </div>
      <ConfirmField show={!confirmed} state={state} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="decision" value="approve" size="S" disabled={pending}>
          Setujui
        </Button>
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

export function UserSearch({
  searchAction,
  revokeAction,
  csrf,
  confirmed,
}: {
  searchAction: FormAction;
  revokeAction: FormAction;
  csrf: string;
  confirmed: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(searchAction, IDLE);
  const emailId = useId();
  const found = state.found;
  return (
    <div className="flex flex-col gap-5">
      <form action={run} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Csrf value={csrf} />
        <TextField
          id={emailId}
          name="email"
          type="email"
          label="Email lengkap"
          autoComplete="off"
          required
          defaultValue={state.values?.email ?? ''}
          hint="Hanya pencocokan persis; daftar akun tidak bisa dijelajah."
          className="sm:flex-1"
        />
        <div>
          <Button type="submit" size="M" disabled={pending}>
            Cari
          </Button>
        </div>
      </form>
      {state.status === 'error' ? <FormMessage state={state} /> : null}
      {state.status === 'done' && found === null ? (
        <p role="status" className="text-body-medium-15">
          Tidak ada akun dengan email itu.
        </p>
      ) : null}
      {found !== undefined && found !== null ? (
        <section
          aria-label="Hasil pencarian"
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
            <dt className="text-ink-2">Email</dt>
            <dd>{found.email}</dd>
            <dt className="text-ink-2">Peran</dt>
            <dd>{ROLE[found.role] ?? found.role}</dd>
            <dt className="text-ink-2">Email terverifikasi</dt>
            <dd>{found.emailVerified ? 'Ya' : 'Belum'}</dd>
            <dt className="text-ink-2">Terdaftar</dt>
            <dd>{found.createdAt.slice(0, 10)}</dd>
          </dl>
          {found.role === 'analyst' ? (
            <RevokeForm action={revokeAction} csrf={csrf} id={found.id} confirmed={confirmed} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function RevokeForm({
  action,
  csrf,
  id,
  confirmed,
}: {
  action: FormAction;
  csrf: string;
  id: string;
  confirmed: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  if (state.status === 'done') return <FormMessage state={state} />;
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="id" value={id} />
      <ConfirmField show={!confirmed} state={state} />
      <div>
        <Button type="submit" variant="secondary" size="S" disabled={pending}>
          Cabut peran Analis
        </Button>
      </div>
    </form>
  );
}

export interface EditorArticle {
  slug: string;
  category: string;
  title: string;
  summary: string;
  bodyMd: string;
  revision: number;
}

/** Markdown editor (create or edit). The preview below the form shows the saved version. */
export function ArticleEditor({
  action,
  csrf,
  confirmed,
  article,
  imageOrigins,
}: {
  action: FormAction;
  csrf: string;
  confirmed: boolean;
  article: EditorArticle | null;
  imageOrigins: readonly string[];
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  const id = useId();
  const v = state.values;
  const err = (name: string): string | undefined => state.fields?.[name];
  return (
    <form action={run} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      {article === null ? (
        <TextField
          id={`${id}-slug`}
          name="slug"
          label="Slug (alamat artikel)"
          required
          maxLength={80}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={v?.slug ?? ''}
          error={err('slug')}
          hint="Huruf kecil, angka, dan tanda hubung. Tidak bisa diubah setelah disimpan."
        />
      ) : (
        <>
          <input type="hidden" name="slug" value={article.slug} />
          <input type="hidden" name="baseRevision" value={article.revision} />
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-category`} className="text-[14px] font-semibold">
          Kategori
        </label>
        <select
          id={`${id}-category`}
          name="category"
          defaultValue={v?.category ?? article?.category ?? 'dasar'}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-[15px]"
        >
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <TextField
        id={`${id}-title`}
        name="title"
        label="Judul"
        required
        maxLength={120}
        defaultValue={v?.title ?? article?.title ?? ''}
        error={err('title')}
      />
      <TextField
        id={`${id}-summary`}
        name="summary"
        label="Ringkasan"
        required
        maxLength={300}
        defaultValue={v?.summary ?? article?.summary ?? ''}
        error={err('summary')}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-body`} className="text-[14px] font-semibold">
          Isi (Markdown)
        </label>
        <textarea
          id={`${id}-body`}
          name="bodyMd"
          required
          rows={18}
          defaultValue={v?.bodyMd ?? article?.bodyMd ?? ''}
          aria-invalid={err('bodyMd') === undefined ? undefined : true}
          aria-describedby={`${id}-body-hint${err('bodyMd') === undefined ? '' : ` ${id}-body-error`}`}
          className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-[14px]"
        />
        {err('bodyMd') === undefined ? null : (
          <p id={`${id}-body-error`} className="text-body-small-13 text-chili-700">
            {err('bodyMd')}
          </p>
        )}
        <p id={`${id}-body-hint`} className="text-body-small-13 text-muted-text">
          Judul bagian dengan <code>## </code>, tautan <code>[teks](https://…)</code> atau{' '}
          <code>[teks](/harga)</code>, gambar <code>![deskripsi](https://…)</code> hanya dari:{' '}
          {imageOrigins.map((o) => o.replace('https://', '')).join(', ')}. HTML tidak didukung.
          Paling besar 50 KB.
        </p>
      </div>
      <ConfirmField show={!confirmed} state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {article === null ? 'Simpan draf' : 'Simpan perubahan'}
        </Button>
      </div>
    </form>
  );
}

export function PublishForm({
  action,
  csrf,
  slug,
  published,
  confirmed,
}: {
  action: FormAction;
  csrf: string;
  slug: string;
  published: boolean;
  confirmed: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="publish" value={published ? '0' : '1'} />
      <ConfirmField show={!confirmed} state={state} />
      <div>
        <Button
          type="submit"
          variant={published ? 'secondary' : 'brand'}
          size="S"
          disabled={pending}
        >
          {published ? 'Tarik dari situs' : 'Terbitkan'}
        </Button>
      </div>
    </form>
  );
}

export function RestoreForm({
  action,
  csrf,
  slug,
  revision,
  baseRevision,
  confirmed,
}: {
  action: FormAction;
  csrf: string;
  slug: string;
  revision: number;
  baseRevision: number;
  confirmed: boolean;
}): ReactNode {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <Csrf value={csrf} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="baseRevision" value={baseRevision} />
      <ConfirmField show={!confirmed && state.status !== 'idle'} state={state} />
      <div>
        <Button type="submit" variant="ghost" size="S" disabled={pending}>
          Pulihkan revisi {revision}
        </Button>
      </div>
    </form>
  );
}
