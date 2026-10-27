'use client';

import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';

import { cn } from '../cn.js';

export type TextFieldProps = Omit<AriaTextFieldProps, 'className' | 'children'> & {
  readonly label: string;
  readonly description?: string;
  readonly className?: string;
};

/** Labelled input with inline error tied through aria-describedby (docs 09 §8). */
export function TextField({ label, description, className, ...props }: TextFieldProps) {
  return (
    <AriaTextField {...props} className={cn('flex flex-col gap-1', className)}>
      <Label className="text-base text-text-secondary">{label}</Label>
      <Input
        className={cn(
          'min-h-12 rounded-md border border-border-control bg-bg-surface px-3 text-lg text-text-primary',
          'outline-none data-[focused]:outline-2 data-[focused]:outline-offset-2 data-[focused]:outline-border-focus',
          'data-[invalid]:border-status-error-fg',
        )}
      />
      {description === undefined ? null : (
        <Text slot="description" className="text-sm text-text-secondary">
          {description}
        </Text>
      )}
      <FieldError className="text-xs text-status-error-fg" />
    </AriaTextField>
  );
}
