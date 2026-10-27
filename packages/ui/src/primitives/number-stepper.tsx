'use client';

import {
  Button,
  Group,
  Input,
  Label,
  NumberField,
  type NumberFieldProps,
} from 'react-aria-components';

import { cn } from '../cn.js';
import { FOCUS_RING } from './focus.js';

export type NumberStepperProps = Omit<NumberFieldProps, 'className' | 'children'> & {
  readonly label: string;
  /** Shown after the value, e.g. "porsi/hari" or "g". */
  readonly unit?: string;
  /** Wider input for formatted values such as rupiah. */
  readonly isWide?: boolean;
  readonly className?: string;
};

const STEP_BUTTON = cn(
  'flex size-12 cursor-pointer items-center justify-center text-2xl font-bold text-text-brand',
  'data-[disabled]:opacity-40 data-[hovered]:bg-bg-brand-subtle',
  FOCUS_RING,
);

/**
 * QtyInput (docs 10 §7.1): role="spinbutton" with labelled − and + buttons.
 * React Aria snaps values to multiples of `step` counted from `minValue`, so pick both to keep
 * real values valid (minValue 0 with step 5 keeps 120 at 120; minValue 1 would make it 121).
 */
export function NumberStepper({
  label,
  unit,
  isWide = false,
  className,
  ...props
}: NumberStepperProps) {
  return (
    <NumberField {...props} className={cn('flex flex-col gap-1', className)}>
      <Label className="text-base text-text-secondary">{label}</Label>
      <div className="flex items-center gap-2">
        <Group className="inline-flex items-center overflow-hidden rounded-md border border-border-control bg-bg-surface">
          <Button slot="decrement" className={STEP_BUTTON}>
            −
          </Button>
          <Input
            className={cn(
              'bg-transparent text-center text-lg font-semibold text-text-primary tabular-nums outline-none',
              isWide ? 'w-36' : 'w-20',
            )}
          />
          <Button slot="increment" className={STEP_BUTTON}>
            +
          </Button>
        </Group>
        {unit === undefined ? null : <span className="text-base text-text-secondary">{unit}</span>}
      </div>
    </NumberField>
  );
}
