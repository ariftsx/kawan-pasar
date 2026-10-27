import { cn } from '../cn.js';

export type Direction = 'up' | 'down' | 'flat';

/** Rounds to the 0.1 % shown, so a change that displays as 0,0% is never drawn as a rise. */
export function directionOf(change: number): Direction {
  const shown = Math.round(change * 1000);
  if (shown > 0) return 'up';
  if (shown < 0) return 'down';
  return 'flat';
}

const ARROW: ReadonlyMap<Direction, string> = new Map([
  ['up', '↑'],
  ['down', '↓'],
  ['flat', '—'],
]);

const TONE: ReadonlyMap<Direction, string> = new Map([
  ['up', 'bg-status-up-bg text-status-up-fg'],
  ['down', 'bg-status-down-bg text-status-down-fg'],
  ['flat', 'bg-bg-subtle text-text-secondary'],
]);

const SPOKEN: ReadonlyMap<Direction, string> = new Map([
  ['up', 'naik'],
  ['down', 'turun'],
  ['flat', 'tetap'],
]);

export type MovementBadgeProps = {
  readonly change: number;
  /** The formatted, signed percentage, e.g. "+3,2%" (apps format with id-ID rules). */
  readonly label: string;
  readonly className?: string;
};

/** Direction is shown by arrow and sign, never by colour alone (docs 09 §8). */
export function MovementBadge({ change, label, className }: MovementBadgeProps) {
  const direction = directionOf(change);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-sm font-bold tabular-nums',
        TONE.get(direction),
        className,
      )}
    >
      <span aria-hidden="true">{ARROW.get(direction)}</span>
      <span className="sr-only">{SPOKEN.get(direction)} </span>
      {label}
    </span>
  );
}
