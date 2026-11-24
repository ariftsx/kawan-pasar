import { COMMODITIES } from '@kawan-pasar/catalog';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Chip } from '@/components/atoms/Chip';
import { AdminTable } from '@/components/organisms/admin/AdminTable';
import { adminContext } from '@/lib/admin/context';
import { CANDIDATE_STATUS } from '@/lib/admin/model-labels';
import { adminApi } from '@/lib/auth/api';
import { adminHrefs } from '@/lib/hrefs';

const when = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const two = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const NOTICE = {
  disetujui: 'Kandidat disetujui: bundelnya kini aktif dan prediksi di situs sudah diperbarui.',
} as const;

/** Model page of the admin (Fase 4C): the candidates from the retraining pipeline. */
export default async function AdminModels({
  searchParams,
}: {
  searchParams: Promise<{ pesan?: string }>;
}): Promise<ReactNode> {
  const { token } = await adminContext();
  const [list, { pesan }] = await Promise.all([adminApi.candidates(token), searchParams]);
  const notice = pesan === 'disetujui' ? NOTICE[pesan] : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading-title-20">Kandidat model ARIF-Net</h2>
        <p className="max-w-3xl text-ink-2">
          Setiap latih ulang menghasilkan kandidat. Kandidat tidak pernah tampil di situs sampai
          admin mengauditnya dan menyetujuinya. Kandidat dari run terkunci hanya untuk verifikasi.
        </p>
      </div>
      {notice === null ? null : (
        <p role="status" className="text-body-medium-15 text-green-700">
          {notice}
        </p>
      )}
      {!list.ok ? (
        <p role="alert">Daftar kandidat belum bisa dimuat.</p>
      ) : (
        <AdminTable
          caption="Kandidat model terbaru"
          head={[
            'Dibuat',
            'Data sampai',
            'Komoditas',
            'relMAE gabungan',
            'Kunci',
            'Status',
            'Tindakan',
          ]}
          rows={list.data.items.map((c) => [
            `${when.format(new Date(c.createdAt))} WIB`,
            c.dataEnd,
            c.commodities
              .map((code) => COMMODITIES.find((x) => x.code === code)?.name ?? code)
              .join(', '),
            <span
              key="r"
              className={c.overallRelmae >= 1 ? 'font-semibold text-chili-700' : undefined}
            >
              {two.format(c.overallRelmae)}
            </span>,
            c.lockOpen ? 'Terbuka' : 'Terkunci (verifikasi)',
            <Chip key="s" tone={c.status === 'approved' ? 'terong' : 'neutral'} size="S">
              {CANDIDATE_STATUS[c.status]}
            </Chip>,
            <Link
              key="a"
              href={adminHrefs.model(c.id)}
              className="font-semibold text-green-900 underline"
            >
              Audit
            </Link>,
          ])}
        />
      )}
    </div>
  );
}
