import type { AdminPipelineResponse } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { Chip } from '@/components/atoms/Chip';
import { AdminTable } from '@/components/organisms/admin/AdminTable';
import { ConfirmStatus } from '@/components/organisms/admin/ConfirmStatus';
import { PipelineControl, ScheduleForm } from '@/components/organisms/admin/PipelineForms';
import { pipelineAction, scheduleAction } from '@/lib/admin/actions';
import { adminContext } from '@/lib/admin/context';
import { adminApi } from '@/lib/auth/api';

const when = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const at = (iso: string | null): string =>
  iso === null ? '—' : `${when.format(new Date(iso))} WIB`;
const day = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const PRESETS = [
  ['weekly_monday', 'Setiap Senin pukul 02.00 WIB'],
  ['daily', 'Setiap hari pukul 02.00 WIB'],
  ['biweekly_monday', 'Dua minggu sekali: Senin minggu genap pukul 02.00 WIB'],
  ['monthly_first_monday', 'Senin pertama setiap bulan pukul 02.00 WIB'],
  ['manual', 'Hanya manual dari halaman ini'],
] as const;

const DAG = {
  harga_harian: {
    title: 'Harga harian',
    about: 'Senin–Jumat 10.00 WIB: ambil harga PIHPS, lalu impor ke Kawan Pasar.',
    trigger: 'Ambil harga sekarang',
  },
  latih_ulang: {
    title: 'Latih ulang ARIF-Net',
    about:
      'Mengikuti jadwal di atas: latih ulang ARIF-Net A0, lalu kandidat baru muncul di halaman Model.',
    trigger: 'Latih ulang sekarang',
  },
} as const;

const STATE: Record<string, string> = {
  success: 'Berhasil',
  failed: 'Gagal',
  running: 'Berjalan',
  queued: 'Antre',
  skipped: 'Dilewati',
  upstream_failed: 'Tidak dijalankan',
  up_for_retry: 'Menunggu ulang',
  scheduled: 'Terjadwal',
};
const RUN_TYPE: Record<string, string> = { scheduled: 'Terjadwal', manual: 'Manual' };
const state = (s: string | null): string => (s === null ? '—' : (STATE[s] ?? s));

function tasks(run: AdminPipelineResponse['dags'][number]['runs'][number]): string {
  return run.tasks.map((t) => `${t.id}: ${state(t.state)}`).join(' · ') || '—';
}

/** Pipeline page of the admin (Fase 4C): Airflow, the prospective-test lock and the schedule. */
export default async function AdminPipeline(): Promise<ReactNode> {
  const { token, csrf, confirmedUntil } = await adminContext();
  const r = await adminApi.pipeline(token);
  if (!r.ok) return <p role="alert">Data pipeline belum bisa dimuat.</p>;
  const p = r.data;
  const confirmed = confirmedUntil !== null;
  const quotaLeft = p.triggersToday.limit - p.triggersToday.used;

  return (
    <div className="flex flex-col gap-8">
      <ConfirmStatus confirmedUntil={confirmedUntil} />

      <section aria-labelledby="kunci" className="flex flex-col gap-3">
        <h2 id="kunci" className="text-heading-title-20">
          Uji prospektif ARIF-Net
        </h2>
        {p.airflow === 'inactive' ? (
          <p className="rounded-xl border border-line bg-surface-2 p-4" role="status">
            Airflow tidak aktif. Halaman ini hanya menampilkan jadwal. Nyalakan profil airflow untuk
            melihat status kunci dan run.
          </p>
        ) : p.lock === null ? (
          <p className="text-ink-2">
            Status kunci belum diperiksa (DAG status_kunci berjalan tiap jam).
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <p className="flex flex-wrap items-center gap-2">
              <Chip tone={p.lock.open ? 'terong' : 'neutral'} size="S">
                {p.lock.open ? 'Terbuka' : 'Menunggu pembukaan uji prospektif'}
              </Chip>
              {p.lock.dataCeiling === null ? null : (
                <span className="text-body-small-13 text-ink-2">
                  Data sampai {day.format(new Date(`${p.lock.dataCeiling}T00:00:00Z`))}
                </span>
              )}
            </p>
            <p>{p.lock.reason}</p>
            <p className="text-body-small-13 text-ink-2">Diperiksa {at(p.lock.checkedAt)}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="jadwal" className="flex flex-col gap-3">
        <h2 id="jadwal" className="text-heading-title-20">
          Jadwal latih ulang
        </h2>
        <p className="text-ink-2">
          Sekarang: {p.schedule.label}.{' '}
          {p.schedule.next === null
            ? 'Latih ulang hanya dari tombol di bawah.'
            : `Berikutnya: ${day.format(new Date(`${p.schedule.next}T00:00:00Z`))}.`}
        </p>
        <ScheduleForm
          action={scheduleAction}
          csrf={csrf}
          current={p.schedule.preset}
          options={PRESETS}
          confirmed={confirmed}
        />
      </section>

      {p.dags.map((d) => (
        <section key={d.id} aria-labelledby={`dag-${d.id}`} className="flex flex-col gap-3">
          <h2
            id={`dag-${d.id}`}
            className="flex flex-wrap items-center gap-2 text-heading-title-20"
          >
            {DAG[d.id].title}
            {d.paused ? (
              <Chip tone="neutral" size="S">
                Dijeda
              </Chip>
            ) : null}
          </h2>
          <p className="text-ink-2">{DAG[d.id].about}</p>
          {d.id === 'latih_ulang' ? (
            <p className="text-body-small-13 text-ink-2">
              Latih ulang manual hari ini: {p.triggersToday.used} dari {p.triggersToday.limit}.
              {p.lock?.open === false
                ? ' Selama uji prospektif terkunci, latih ulang hanya verifikasi (data sampai 30 Sep 2026).'
                : ''}
            </p>
          ) : null}
          <PipelineControl
            action={pipelineAction}
            csrf={csrf}
            dag={d.id}
            paused={d.paused}
            confirmed={confirmed}
            triggerLabel={DAG[d.id].trigger}
            triggerDisabled={d.id === 'latih_ulang' && quotaLeft <= 0}
          />
          <AdminTable
            caption={`Run terakhir ${DAG[d.id].title}`}
            head={['Waktu', 'Jenis', 'Status', 'Selesai', 'Tugas']}
            rows={d.runs.map((run) => [
              at(run.runAfter ?? run.startedAt),
              RUN_TYPE[run.runType] ?? run.runType,
              <span
                key="s"
                className={run.state === 'failed' ? 'font-semibold text-chili-700' : undefined}
              >
                {state(run.state)}
              </span>,
              at(run.endedAt),
              tasks(run),
            ])}
          />
        </section>
      ))}
    </div>
  );
}
