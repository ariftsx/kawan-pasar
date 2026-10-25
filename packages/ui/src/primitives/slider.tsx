import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  type SliderProps as AriaSliderProps,
} from 'react-aria-components';

import { cn } from '../cn.js';

export type SliderProps = Omit<AriaSliderProps<number>, 'className' | 'children'> & {
  readonly label: string;
  readonly className?: string;
};

export function Slider({ label, className, ...props }: SliderProps) {
  return (
    <AriaSlider {...props} className={cn('flex flex-col gap-2', className)}>
      <div className="flex justify-between text-sm">
        <Label className="text-text-secondary">{label}</Label>
        <SliderOutput className="font-mono text-text-primary" />
      </div>
      <SliderTrack className="relative h-11 w-full">
        {({ state }) => (
          <>
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-bg-muted" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-bg-brand"
              style={{ width: `${String(state.getThumbPercent(0) * 100)}%` }}
            />
            <SliderThumb
              className={cn(
                'top-1/2 size-6 rounded-full border-2 border-border-brand bg-bg-surface shadow-1',
                'data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-border-focus',
              )}
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
