import type { ReactNode } from 'react';
import { adminContext } from '@/lib/admin/context';
import { adminApi } from '@/lib/auth/api';
import { AdminTable as Table } from '@/components/organisms/admin/AdminTable';

const when = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const at = (iso: string | null): string =>
  iso === null ? '—' : `${when.format(new Date(iso))} WIB`;

const INGEST = { running: 'Berjalan', succeeded: 'Berhasil', partial: 'Sebagian', failed: 'Gagal' };
const BUNDLE = { pending: 'Menunggu', active: 'Aktif', retired: 'Diganti', rejected: 'Ditolak' };
const QUEUE = { mail: 'Email', alerts: 'Peringatan', whatsapp: 'WhatsApp' };

/** Read-only operations view (Fase 3B task 5): counts and statuses, never job contents. */
export default async function AdminMonitoring(): Promise<ReactNode> {
  const { token } = await adminContext();
  const m = await adminApi.monitoring(token);
  if (!m.ok) return <p role="alert">Data pemantauan belum bisa dimuat.</p>;
  const { ingestRuns, bundles, queues } = m.data;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="antrean" className="flex flex-col gap-3">
        <h2 id="antrean" className="text-heading-title-20">
          Antrean
        </h2>
        <Table
          caption="Jumlah job per antrean"
          head={['Antrean', 'Menunggu', 'Diproses', 'Tertunda', 'Gagal']}
          rows={queues.map((q) => [
            QUEUE[q.name],
            q.waiting,
            q.active,
            q.delayed,
            <span key="f" className={q.failed > 0 ? 'font-semibold text-chili-700' : undefined}>
              {q.failed}
            </span>,
          ])}
        />
      </section>
      <section aria-labelledby="impor" className="flex flex-col gap-3">
        <h2 id="impor" className="text-heading-title-20">
          Impor harga (20 terakhir)
        </h2>
        <Table
          caption="Impor harga terakhir"
          head={['Mulai', 'Selesai', 'Status', 'Masuk', 'Dilewati', 'Ditolak', 'Galat']}
          rows={ingestRuns.map((r) => [
            at(r.startedAt),
            at(r.finishedAt),
            INGEST[r.status],
            r.rowsInserted,
            r.rowsSkipped,
            r.rowsRejected,
            r.error ?? '—',
          ])}
        />
      </section>
      <section aria-labelledby="bundel" className="flex flex-col gap-3">
        <h2 id="bundel" className="text-heading-title-20">
          Bundel prediksi (20 terakhir)
        </h2>
        <Table
          caption="Bundel prediksi terakhir"
          head={['Bundel', 'Model', 'Status', 'Umur', 'Alasan ditolak']}
          rows={bundles.map((b) => [
            <code key="b" className="text-[13px]">
              {b.bundleId}
            </code>,
            `${b.modelName} ${b.modelVersion}${b.isDemo ? ' (demo)' : ''}`,
            BUNDLE[b.status],
            `${String(b.ageDays)} hari`,
            b.rejectReasons.length === 0 ? '—' : b.rejectReasons.join(', '),
          ])}
        />
      </section>
    </div>
  );
}
