import { cn } from '../cn.js';

/** docs 08 §4 availability plus the price states the catalog uses (docs 09 §7.3). */
export type DataState =
  | 'available'
  | 'partial'
  | 'missing'
  | 'insufficient_coverage'
  | 'temporally_invalid'
  | 'schema_invalid'
  | 'stale'
  | 'coming_soon';

const LABEL: ReadonlyMap<DataState, { text: string; icon: string; tone: string }> = new Map([
  ['available', { text: 'Tersedia', icon: '●', tone: 'text-status-available-fg' }],
  ['partial', { text: 'Sebagian', icon: '◐', tone: 'text-status-partial-fg' }],
  ['missing', { text: 'Tidak tersedia', icon: '○', tone: 'text-status-missing-fg' }],
  [
    'insufficient_coverage',
    { text: 'Data belum cukup', icon: '○', tone: 'text-status-missing-fg' },
  ],
  ['temporally_invalid', { text: 'Tanggal tidak valid', icon: '!', tone: 'text-status-error-fg' }],
  ['schema_invalid', { text: 'Format tidak valid', icon: '!', tone: 'text-status-error-fg' }],
  ['stale', { text: 'Perlu diperbarui', icon: '◷', tone: 'text-status-partial-fg' }],
  ['coming_soon', { text: 'Harga sedang disiapkan', icon: '◷', tone: 'text-text-muted' }],
]);

export type DataStatusProps = {
  readonly state: DataState;
  /** Overrides the default text when the screen has a more specific sentence. */
  readonly label?: string;
  readonly className?: string;
};

/** Icon + words, never colour alone (docs 10 §7.2, NFR-AX1). */
export function DataStatus({ state, label, className }: DataStatusProps) {
  const entry = LABEL.get(state);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', entry?.tone, className)}>
      <span aria-hidden="true">{entry?.icon}</span>
      {label ?? entry?.text}
    </span>
  );
}
