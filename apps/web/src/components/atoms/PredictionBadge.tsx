import type { ForecastStatus } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { changeDirection, formatChange } from '@/lib/format';
import { Chip } from './Chip';

/**
 * Forecast status chip (v0.4 "PrediksiBadge"). Product rules: an expired forecast is always
 * labelled; hidden/unavailable forecasts show no number at all.
 */
export function PredictionBadge({
  status,
  q50Change,
  isDemo = false,
  size = 'S',
}: {
  status: ForecastStatus;
  q50Change: number | null;
  isDemo?: boolean;
  size?: 'M' | 'S';
}): ReactNode {
  let chip: ReactNode;
  switch (status) {
    case 'available':
    case 'expired': {
      const value =
        q50Change === null
          ? '—'
          : changeDirection(q50Change) === 'flat'
            ? 'stabil'
            : formatChange(q50Change);
      chip = (
        <>
          <Chip tone="terong" size={size}>
            <span className="sr-only">perkiraan </span>
            <span aria-hidden="true">★</span> {value}
          </Chip>
          {status === 'expired' ? (
            <Chip tone="kunyit" size={size}>
              Kedaluwarsa
            </Chip>
          ) : null}
        </>
      );
      break;
    }
    case 'pending_coverage':
      chip = (
        <Chip tone="neutral" size={size}>
          Prediksi menyusul
        </Chip>
      );
      break;
    case 'hidden':
    case 'unavailable':
      chip = (
        <Chip tone="neutral" size={size}>
          Belum tersedia
        </Chip>
      );
      break;
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {chip}
      {isDemo ? (
        <Chip tone="kunyit-solid" size={size}>
          Data demo
        </Chip>
      ) : null}
    </span>
  );
}
