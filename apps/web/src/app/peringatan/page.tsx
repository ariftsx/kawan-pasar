import { Button, Switch, TextField } from '@kawan-pasar/ui';

import { Kapa } from '@/components/brand/kapa';
import { PageHeader, StatusChip, Surface, TextLink } from '@/components/kp/blocks';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Peringatan Harga' };

// Alerts need accounts and a delivery channel (F3). Until then the page shows what the alert will
// look like and keeps the form disabled; it never pretends to save anything.
export default function PeringatanPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="Peringatan"
        title="Kabari saya kalau harga bergerak tidak biasa"
        description="Peringatan dikirim ketika pergerakan harga harian melewati batas pergerakan yang biasa terjadi untuk komoditas itu."
        aside={<StatusChip tone="highlight">Segera hadir</StatusChip>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Surface className="flex flex-col gap-5" aria-labelledby="atur-title">
          <div className="flex flex-col gap-1">
            <h2 id="atur-title" className="text-xl font-extrabold">
              Atur peringatan
            </h2>
            <p className="text-base text-text-secondary">
              Formulir ini belum aktif karena fitur akun dan pengiriman pesan masih dikembangkan.
            </p>
          </div>
          <TextField label="Komoditas" defaultValue="Cabai merah keriting" isDisabled />
          <TextField label="Pasar" defaultValue="Pasar Kramat Jati" isDisabled />
          <Switch isDisabled defaultSelected>
            Pergerakan harian tidak biasa
          </Switch>
          <Switch isDisabled>Perubahan prediksi 7 hari</Switch>
          <Button isDisabled>Simpan peringatan</Button>
        </Surface>

        <div className="flex flex-col gap-5">
          <Surface className="flex flex-col gap-3" aria-labelledby="contoh-title">
            <h2 id="contoh-title" className="text-xl font-extrabold">
              Contoh pesan
            </h2>
            <div className="flex flex-col gap-2 rounded-2xl bg-bg-subtle p-4 text-base">
              <p className="font-semibold">Kawan Pasar</p>
              <p className="text-text-secondary">
                Harga cabai merah keriting di Pasar Kramat Jati naik ↑ +8,4% hari ini, lebih besar
                dari pergerakan biasanya. Cek detail dan konteksnya di Kawan Pasar.
              </p>
              <p className="text-xs text-text-muted">Contoh tampilan, bukan data sebenarnya.</p>
            </div>
          </Surface>

          <Surface className="flex items-center gap-5" aria-labelledby="kosong-title">
            <Kapa pose="istirahat" className="w-24 shrink-0" />
            <div className="flex flex-col gap-1">
              <h2 id="kosong-title" className="text-lg font-bold">
                Belum ada peringatan
              </h2>
              <p className="text-base text-text-secondary">
                Sambil menunggu, pantau pergerakan harga di halaman Harga.
              </p>
              <TextLink href="/harga">Buka Harga</TextLink>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
