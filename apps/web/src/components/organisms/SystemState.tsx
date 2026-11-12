import type { ReactNode } from 'react';
import { formatDateWib } from '@/lib/format';
import { Button } from '../atoms/Button';
import { StatePanel } from '../molecules/StatePanel';
import { RetryButton } from './RetryButton';

export type SystemStateKind =
  'forecast_pending' | 'market_unavailable' | 'price_stale' | 'load_failed' | 'coming_soon';

/**
 * The public system states of v0.4 (plus "coming soon" for pages of later phases), with fixed,
 * reviewed copy. Account states (WhatsApp, alerts) arrive in Fase 2.
 */
export function SystemState({
  kind,
  lastObservedOn,
  commodityName,
  retry,
  headingLevel = 2,
}: {
  kind: SystemStateKind;
  /** For price_stale: date of the latest observation (YYYY-MM-DD). */
  lastObservedOn?: string;
  /** For forecast_pending. */
  commodityName?: string;
  /** For load_failed inside an error boundary: a button that calls the boundary's reset. */
  retry?: ReactNode;
  headingLevel?: 1 | 2;
}): ReactNode {
  switch (kind) {
    case 'forecast_pending':
      return (
        <StatePanel
          headingLevel={headingLevel}
          pose="istirahat"
          chip="Menyusul"
          title={`Prediksi ${commodityName ?? 'komoditas ini'} belum tersedia`}
          body="Harga hari ini tetap bisa Anda pantau. Prediksi untuk komoditas ini menyusul pada tahap pengembangan berikutnya."
          action={<Button href="/harga">Lihat harga hari ini</Button>}
        />
      );
    case 'market_unavailable':
      return (
        <StatePanel
          headingLevel={headingLevel}
          pose="istirahat"
          chip="Segera"
          title="Pasar ini belum tersedia"
          body="Saat ini data tersedia untuk Pasar Kramat Jati. Pasar dan wilayah lain sedang dikembangkan."
          action={<Button href="/beranda">Kembali ke Pasar Kramat Jati</Button>}
        />
      );
    case 'price_stale':
      return (
        <StatePanel
          headingLevel={headingLevel}
          pose="waspada"
          chip="Terlambat"
          chipTone="kunyit"
          title="Harga belum diperbarui"
          body={
            <>
              Data terakhir tercatat pada{' '}
              <strong>
                {lastObservedOn === undefined ? '—' : formatDateWib(lastObservedOn, 'long')}
              </strong>
              . Harga yang tampil mungkin sudah berbeda dengan harga di pasar hari ini.
            </>
          }
        />
      );
    case 'load_failed':
      return (
        <StatePanel
          headingLevel={headingLevel}
          pose="waspada"
          chip="Gagal memuat"
          chipTone="chili"
          title="Data belum bisa dimuat"
          body="Ada gangguan saat mengambil data. Coba lagi sebentar lagi."
          action={retry ?? <RetryButton />}
        />
      );
    case 'coming_soon':
      return (
        <StatePanel
          headingLevel={headingLevel}
          pose="istirahat"
          chip="Segera hadir"
          title="Halaman ini sedang disiapkan"
          body="Kami sedang menyiapkan halaman ini. Sementara itu, Anda bisa melihat harga hari ini."
          action={<Button href="/beranda">Ke Beranda</Button>}
        />
      );
  }
}
