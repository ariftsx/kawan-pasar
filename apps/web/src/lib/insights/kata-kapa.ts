import type { CommoditySummary } from '@kawan-pasar/contracts';
import type { KapaPose } from '@/brand/kapa-poses';
import { changeDirection, formatChange, formatDateWib } from '../format';

export interface KataKapaTip {
  pose: KapaPose;
  title: string;
  body: string;
}

/** Monthly moves at least this large get their own tip. */
const NOTABLE_MONTHLY_CHANGE = 0.05;

const unsigned = (fraction: number): string => formatChange(Math.abs(fraction)).replace('+', '');

/**
 * "Kata Kapa" tip for one commodity. Rules in order; every sentence states a fact from the data
 * (never a cause, never buy/sell advice). `null` when there is nothing to say.
 */
export function kataKapa(item: CommoditySummary): KataKapaTip | null {
  if (item.latest === null) return null;
  if (item.dataStatus === 'stale') {
    return {
      pose: 'waspada',
      title: `Harga ${item.name.toLowerCase()} belum diperbarui.`,
      body: `Data terakhir tercatat ${formatDateWib(item.latest.observedOn, 'long')}. Harga di pasar hari ini bisa berbeda.`,
    };
  }
  if (item.change30d !== null && Math.abs(item.change30d) >= NOTABLE_MONTHLY_CHANGE) {
    const up = item.change30d > 0;
    return {
      pose: up ? 'waspada' : 'senang',
      title: `${item.name} ${up ? 'naik' : 'turun'} ${unsigned(item.change30d)} dalam sebulan.`,
      body: up
        ? 'Pantau perubahannya beberapa hari ke depan sebelum menyusun anggaran belanja.'
        : 'Harga hari ini lebih rendah dibanding sebulan lalu. Angka harian tetap bisa berubah.',
    };
  }
  const f = item.forecast7d;
  const dir = changeDirection(f.q50Change);
  if (f.status === 'available' && f.q50Change !== null && dir !== null && dir !== 'flat') {
    return {
      pose: 'prediksi',
      title: `Perkiraan 7 hari: ${dir === 'up' ? 'naik' : 'turun'} ${unsigned(f.q50Change)}.`,
      body: 'Ini estimasi model, bukan jaminan harga. Rentangnya ada di halaman prediksi.',
    };
  }
  return {
    pose: 'menunjuk',
    title: 'Lihat tren, bukan satu hari saja.',
    body: 'Perubahan harian sering kecil. Grafik 30 dan 90 hari memberi gambaran yang lebih utuh.',
  };
}
