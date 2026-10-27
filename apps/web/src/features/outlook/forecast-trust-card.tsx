'use client';

import { DemoBadge } from '@kawan-pasar/ui';

import { formatMarketDate } from '@/lib/format';

import { OUTLOOK_HORIZON, type OutlookState } from './use-outlook';

/**
 * ForecastTrustCard (docs 10 §7.3): every forecast is one click from its metadata (UX-03).
 * In development mode no model version is shown, because none exists yet (docs 09 §7.4).
 */
export function ForecastTrustCard({ outlook }: { readonly outlook: OutlookState }) {
  if (outlook.status === 'loading') return null;
  if (outlook.status === 'unavailable') {
    return (
      <p className="text-sm text-text-secondary">
        Perkiraan tidak tersedia saat ini. Modal tetap dihitung dengan harga hari ini.
      </p>
    );
  }
  const { provenance, isDemo, limitations } = outlook;
  const rows: [string, string][] = [
    ['Hari dasar perkiraan', formatMarketDate(provenance.origin)],
    ['Horizon', `${String(OUTLOOK_HORIZON)} hari`],
    ['Model', isDemo ? 'Belum tersedia (demo)' : provenance.model_version],
    ['Dataset', isDemo ? '—' : provenance.dataset_version],
    ['Preprocessing', isDemo ? '—' : provenance.preprocessing_version],
    ['Data s.d.', formatMarketDate(provenance.data_cutoff.slice(0, 10))],
  ];
  return (
    <details className="rounded-md border border-border-default bg-bg-subtle p-3 text-sm">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-medium text-text-primary">
        Info perkiraan
        {isDemo ? (
          <>
            <span className="text-xs font-normal text-text-secondary">· dalam pengembangan</span>
            <DemoBadge />
          </>
        ) : null}
      </summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-text-muted">{label}</dt>
            <dd className="tabular-nums text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 list-disc pl-4 text-xs text-text-secondary">
        {limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </details>
  );
}
