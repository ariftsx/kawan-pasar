import { cn } from '../cn.js';

export type StepState = 'done' | 'current' | 'upcoming';

export type StepItemProps = {
  readonly index: number;
  readonly label: string;
  readonly state: StepState;
};

const MARKER: ReadonlyMap<StepState, string> = new Map([
  ['done', 'bg-bg-brand text-text-on-brand'],
  ['current', 'border-2 border-border-brand text-text-brand'],
  ['upcoming', 'border border-border-default text-text-muted'],
]);

/** One step of a stepper (docs 10 §7.1); render inside an <ol>. */
export function StepItem({ index, label, state }: StepItemProps) {
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className="flex items-center gap-2 text-base"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold',
          MARKER.get(state),
        )}
      >
        {state === 'done' ? '✓' : index}
      </span>
      <span
        className={state === 'upcoming' ? 'text-text-secondary' : 'font-semibold text-text-primary'}
      >
        {label}
        {state === 'done' ? <span className="sr-only"> (selesai)</span> : null}
      </span>
    </li>
  );
}
