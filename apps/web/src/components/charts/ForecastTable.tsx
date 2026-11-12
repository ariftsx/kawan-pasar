import type { ReactNode } from 'react';
import type { ForecastRow } from '@/lib/insights/forecast-view';
import { Chip } from '../atoms/Chip';

/** Every horizon as a table (the chart's text alternative; rows are highlighted per horizon). */
export function ForecastTable({ rows }: { rows: readonly ForecastRow[] }): ReactNode {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Tabel prediksi per horizon (bisa digeser)"
      className="relative mt-5 overflow-x-auto rounded-xl border border-line"
    >
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">Prediksi per horizon</caption>
        <thead className="bg-surface-2 text-overline-11 text-muted-text uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">
              Horizon
            </th>
            <th scope="col" className="px-3 py-3">
              Tanggal target
            </th>
            <th scope="col" className="px-3 py-3">
              Perkiraan perubahan
            </th>
            <th scope="col" className="px-3 py-3">
              Perkiraan harga
            </th>
            <th scope="col" className="px-4 py-3">
              Status uji
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.horizonDays}
              data-row={String(r.horizonDays)}
              className="border-t border-line"
            >
              <th scope="row" className="px-4 py-2.5 font-semibold">
                {r.label}
              </th>
              <td className="px-3 py-2.5">{r.target}</td>
              <td className="tabular px-3 py-2.5 font-mono">{r.change}</td>
              <td className="tabular px-3 py-2.5 font-mono">{r.price}</td>
              <td className="px-4 py-2.5">
                <Chip
                  tone={
                    r.eval === 'Tersedia' ? 'green' : r.eval === 'Sebagian' ? 'kunyit' : 'neutral'
                  }
                  size="S"
                >
                  {r.eval}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
