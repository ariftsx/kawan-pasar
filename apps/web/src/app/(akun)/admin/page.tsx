import type { ReactNode } from 'react';
import { ConfirmStatus } from '@/components/organisms/admin/ConfirmStatus';
import { DecisionForm } from '@/components/organisms/admin/AdminForms';
import { decideRequestAction } from '@/lib/admin/actions';
import { adminContext } from '@/lib/admin/context';
import { adminApi } from '@/lib/auth/api';
import { formatDateWib } from '@/lib/format';

/** Pending Analyst requests (Fase 3B task 3). */
export default async function AdminRequests({
  searchParams,
}: {
  searchParams: Promise<{ pesan?: string }>;
}): Promise<ReactNode> {
  const { token, csrf, confirmedUntil } = await adminContext();
  const [requests, { pesan }] = await Promise.all([adminApi.requests(token), searchParams]);
  return (
    <section aria-labelledby="pengajuan" className="flex flex-col gap-4">
      <h2 id="pengajuan" className="text-heading-title-20">
        Pengajuan peran Analis
      </h2>
      <ConfirmStatus confirmedUntil={confirmedUntil} />
      {pesan === 'diputuskan' ? (
        <p role="status" className="text-body-medium-15 text-green-700">
          Keputusan tersimpan. Pengaju sudah diberi kabar dan email.
        </p>
      ) : null}
      {!requests.ok ? (
        <p role="alert">Daftar pengajuan belum bisa dimuat. Coba lagi sebentar lagi.</p>
      ) : requests.data.items.length === 0 ? (
        <p className="text-body-medium-15 text-ink-2">Tidak ada pengajuan yang menunggu.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.data.items.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{r.email}</span>
                <span className="text-body-small-13 text-muted-text">
                  Diajukan {formatDateWib(r.createdAt.slice(0, 10), 'short')}
                </span>
              </div>
              {r.organization === null ? null : (
                <p className="text-body-small-13 text-ink-2">Instansi: {r.organization}</p>
              )}
              <blockquote className="border-l-4 border-line pl-3 text-body-medium-15">
                {r.reason}
              </blockquote>
              <DecisionForm
                action={decideRequestAction}
                csrf={csrf}
                id={r.id}
                confirmed={confirmedUntil !== null}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
