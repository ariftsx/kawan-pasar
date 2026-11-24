import { COMMODITIES } from '@kawan-pasar/catalog';
import type { AdminModelCandidateDetail } from '@kawan-pasar/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Chip } from '@/components/atoms/Chip';
import { AdminTable } from '@/components/organisms/admin/AdminTable';
import { ConfirmStatus } from '@/components/organisms/admin/ConfirmStatus';
import { CandidateDecisionForm } from '@/components/organisms/admin/PipelineForms';
import { decideCandidateAction } from '@/lib/admin/actions';
import { adminContext } from '@/lib/admin/context';
import { CANDIDATE_STATUS } from '@/lib/admin/model-labels';
import { adminApi } from '@/lib/auth/api';
import { formatRupiah } from '@/lib/format';
import { adminHrefs } from '@/lib/hrefs';

const HORIZONS = ['1', '3', '7', '14', '30', '90', '180', '365'] as const;
const three = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const when = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const BLOCKER: Record<string, string> = {
  locked:
    'Terkunci: dilatih dengan data sampai 30 Sep 2026 sebelum uji prospektif dibuka. Hanya untuk verifikasi, tidak bisa disetujui.',
  quality: 'Mutu: relMAE gabungan belum di bawah 1 (belum lebih baik dari naive).',
  runtime: 'Runtime: bundel tidak lolos verifikator promosi.',
  expired: 'Umur: bundel lebih dari 28 hari, jalankan latih ulang.',
  decided: 'Sudah diputuskan.',
  files: 'Berkas: folder bundel kandidat tidak ditemukan.',
  superseded:
    'Sudah ada bundel yang lebih baru aktif: menyetujui kandidat ini akan memundurkan prediksi.',
};

const name = (code: string): string => COMMODITIES.find((c) => c.code === code)?.name ?? code;
const range = (q: { q10: number | null; q50: number | null; q90: number | null }): string =>
  q.q50 === null ? '—' : `${formatRupiah(q.q50)} (${formatRupiah(q.q10)}–${formatRupiah(q.q90)})`;

function Gate({ ok, label, detail }: { ok: boolean; label: string; detail: string }): ReactNode {
  return (
    <li className="flex flex-wrap items-baseline gap-2">
      <Chip tone={ok ? 'terong' : 'neutral'} size="S">
        {ok ? 'Lolos' : 'Belum lolos'}
      </Chip>
      <span className="font-semibold">{label}</span>
      <span className="text-ink-2">{detail}</span>
    </li>
  );
}

function scoreCell(v: number | undefined): ReactNode {
  if (v === undefined) return '—';
  return (
    <span className={v >= 1 ? 'font-semibold text-chili-700' : undefined}>{three.format(v)}</span>
  );
}

/** Audit of one candidate (Fase 4C, design § 4): runtime, quality, plausibility, decision. */
export default async function AdminModelAudit({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { token, csrf, confirmedUntil } = await adminContext();
  const r = await adminApi.candidate(token, id);
  if (!r.ok) {
    if (r.code === 'not_found') notFound();
    return <p role="alert">Kandidat belum bisa dimuat.</p>;
  }
  const { candidate: c, audit }: AdminModelCandidateDetail = r.data;
  const blockers = audit.blockers;
  return (
    <div className="flex flex-col gap-8">
      <p>
        <Link href={adminHrefs.models()} className="font-semibold text-green-900 underline">
          ← Semua kandidat
        </Link>
      </p>
      <section aria-labelledby="kandidat" className="flex flex-col gap-2">
        <h2 id="kandidat" className="flex flex-wrap items-center gap-2 text-heading-title-20">
          {c.modelVersion}
          <Chip tone={c.status === 'approved' ? 'terong' : 'neutral'} size="S">
            {CANDIDATE_STATUS[c.status]}
          </Chip>
        </h2>
        <dl className="grid gap-x-8 gap-y-1 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="inline text-ink-2">Run: </dt>
            <dd className="inline">{c.runId}</dd>
          </div>
          <div>
            <dt className="inline text-ink-2">Data sampai: </dt>
            <dd className="inline">{c.dataEnd}</dd>
          </div>
          <div>
            <dt className="inline text-ink-2">Jendela evaluasi: </dt>
            <dd className="inline">
              {c.window.start} – {c.window.end}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink-2">Bundel diterbitkan: </dt>
            <dd className="inline">
              {audit.issuedAt === null ? '—' : `${when.format(new Date(audit.issuedAt))} WIB`}
            </dd>
          </div>
        </dl>
        {c.note === null ? null : <p className="text-ink-2">Catatan keputusan: {c.note}</p>}
      </section>

      <section aria-labelledby="gerbang" className="flex flex-col gap-3">
        <h2 id="gerbang" className="text-heading-title-20">
          Gerbang audit
        </h2>
        <ul className="flex flex-col gap-2">
          <Gate
            ok={audit.runtime.ok}
            label="Runtime"
            detail={
              audit.runtime.ok
                ? 'Bundel lolos verifikator promosi (checksum, skema, cakupan, umur).'
                : `Alasan: ${audit.runtime.reasons.join(', ')}`
            }
          />
          <Gate
            ok={audit.quality.pass}
            label="Mutu"
            detail={`relMAE gabungan ${three.format(audit.quality.overall)} (harus < 1)${
              audit.quality.activeOverall === null
                ? '.'
                : `; model aktif ${three.format(audit.quality.activeOverall)}.`
            }`}
          />
          <Gate
            ok={c.lockOpen}
            label="Protokol"
            detail={
              c.lockOpen
                ? 'Dilatih setelah uji prospektif dibuka.'
                : 'Dilatih saat uji prospektif masih terkunci (data sampai 30 Sep 2026).'
            }
          />
        </ul>
        {blockers.length === 0 ? (
          <p className="text-green-700">Semua gerbang lolos. Kandidat bisa disetujui.</p>
        ) : (
          <ul className="list-disc pl-5 text-ink-2">
            {blockers.map((b) => (
              <li key={b}>{BLOCKER[b] ?? b}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="skor" className="flex flex-col gap-3">
        <h2 id="skor" className="text-heading-title-20">
          relMAE per komoditas dan horizon
        </h2>
        <p className="text-body-small-13 text-ink-2">
          Lebih kecil lebih baik; di bawah 1 berarti lebih baik dari naive (harga hari ini). Angka
          tebal merah ≥ 1. Rata-rata 5 seed pada jendela evaluasi; bukan bukti independen.
        </p>
        <AdminTable
          caption="relMAE kandidat per komoditas dan horizon"
          head={['Komoditas', ...HORIZONS.map((h) => `${h} hr`)]}
          rows={Object.entries(c.scores).map(([code, byH]) => [
            name(code),
            ...HORIZONS.map((h) => scoreCell(byH[h])),
          ])}
        />
      </section>

      <section aria-labelledby="contoh" className="flex flex-col gap-3">
        <h2 id="contoh" className="text-heading-title-20">
          Contoh prediksi (Kramat Jati)
        </h2>
        <p className="text-body-small-13 text-ink-2">
          Median dan rentang 80% dalam rupiah per kg. Periksa apakah angkanya masuk akal.
        </p>
        <AdminTable
          caption="Contoh prediksi kandidat"
          head={['Komoditas', 'Harga dasar', '7 hari', '30 hari', '90 hari']}
          rows={audit.samples.map((s) => [
            name(s.commodity),
            formatRupiah(s.basePriceIdr),
            range(s.h7),
            range(s.h30),
            range(s.h90),
          ])}
        />
      </section>

      {c.status === 'pending' ? (
        <section aria-labelledby="keputusan" className="flex flex-col gap-3">
          <h2 id="keputusan" className="text-heading-title-20">
            Keputusan
          </h2>
          <ConfirmStatus confirmedUntil={confirmedUntil} />
          <p className="text-ink-2">
            Menyetujui mengaktifkan bundel ini di situs. Menolak menyimpan alasan Anda dan, bila uji
            prospektif sudah dibuka, memicu latih ulang (paling banyak 3 kali sehari).
          </p>
          <CandidateDecisionForm
            action={decideCandidateAction}
            csrf={csrf}
            id={c.id}
            confirmed={confirmedUntil !== null}
            approvable={blockers.length === 0}
          />
        </section>
      ) : null}
    </div>
  );
}
