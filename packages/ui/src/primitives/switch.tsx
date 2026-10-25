'use client';

import { SwitchButton, SwitchField, type SwitchFieldProps } from 'react-aria-components/Switch';

import { cn } from '../cn.js';

export type SwitchProps = Omit<SwitchFieldProps, 'className' | 'children'> & {
  readonly children: string;
  readonly className?: string;
};

/** Toggle (docs 10 §7.1): role="switch" with its label as visible text. */
export function Switch({ children, className, ...props }: SwitchProps) {
  return (
    <SwitchField {...props} className={cn('flex flex-col gap-1', className)}>
      <SwitchButton className="group relative flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <span
          className={cn(
            'relative h-6 w-10 shrink-0 rounded-full bg-bg-muted transition-colors',
            'group-data-[selected]:bg-bg-brand',
            'group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-border-focus',
          )}
        >
          <span className="absolute top-1 left-1 size-4 rounded-full bg-bg-surface shadow-1 transition-transform group-data-[selected]:translate-x-4" />
        </span>
        {children}
      </SwitchButton>
    </SwitchField>
  );
}
