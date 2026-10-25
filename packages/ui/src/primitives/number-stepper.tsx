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
  readonly className?: string;
};

const STEP_BUTTON = cn(
  'flex size-11 cursor-pointer items-center justify-center text-lg text-text-brand',
  'data-[disabled]:opacity-40 data-[hovered]:bg-bg-brand-subtle',
  FOCUS_RING,
);

/** QtyInput (docs 10 §7.1): role="spinbutton" with labelled − and + buttons. */
export function NumberStepper({ label, unit, className, ...props }: NumberStepperProps) {
  return (
    <NumberField {...props} className={cn('flex flex-col gap-1', className)}>
      <Label className="text-sm text-text-secondary">{label}</Label>
      <div className="flex items-center gap-2">
        <Group className="inline-flex items-center overflow-hidden rounded-md border border-border-control bg-bg-surface">
          <Button slot="decrement" className={STEP_BUTTON}>
            −
          </Button>
          <Input className="w-16 bg-transparent text-center font-mono text-base text-text-primary outline-none" />
          <Button slot="increment" className={STEP_BUTTON}>
            +
          </Button>
        </Group>
        {unit === undefined ? null : <span className="text-sm text-text-muted">{unit}</span>}
      </div>
    </NumberField>
  );
}
