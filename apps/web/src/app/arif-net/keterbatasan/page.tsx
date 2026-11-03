import { Bullets, KataKapa, PageHeader, Surface } from '@/components/kp/blocks';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Keterbatasan' };

const GROUPS = [
  {
    title: 'Data',
    items: [
      'Harga berasal dari PIHPS untuk Pasar Kramat Jati saja dan bukan harga real-time.',
      'Data hari libur atau hari tanpa laporan bisa kosong; nilainya tidak diisi tebakan.',
      'Konteks cuaca, berita, dan distribusi belum tersedia untuk semua tanggal.',
    ],
  },
  {
    title: 'Model',
    items: [
      'ARIF-Net baru memprediksi tiga komoditas: cabai merah keriting, bawang merah, dan beras medium.',
      'Rentang ketidakpastian belum diterbitkan, sehingga yang tampil hanya satu nilai perkiraan.',
      'Horizon 90 hari baru teruji sebagian; 180 hari dan 1 tahun belum diuji dan tidak ditampilkan.',
      'Kejadian luar biasa yang belum pernah ada di data masa lalu sulit diperkirakan.',
    ],
  },
  {
    title: 'Produk',
    items: [
      'Kawan Pasar tidak memberi saran membeli, menjual, atau menimbun.',
      'Konteks ditampilkan sebagai informasi pendamping, bukan penyebab pasti perubahan harga.',
      'Peringatan dan akun pengguna masih dikembangkan.',
    ],
  },
] as const;

export default function KeterbatasanPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="ARIF-Net"
        title="Keterbatasan yang perlu diketahui"
        description="Kami menuliskan batasan ini supaya angka di Kawan Pasar dipakai dengan tepat."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <Surface key={group.title} className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold">{group.title}</h2>
            <Bullets items={group.items} />
          </Surface>
        ))}
      </div>
      <KataKapa pose="waspada" title="Ragu dengan angka? Bandingkan dengan sumber resmi.">
        Untuk harga resmi lihat PIHPS, dan untuk inflasi lihat rilis BPS.
      </KataKapa>
    </div>
  );
}
