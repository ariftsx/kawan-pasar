import type { ReactNode, SelectHTMLAttributes } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Labelled native <select> (v0.4 SelectField). Native control: keyboard, screen reader and
 * mobile pickers work without JavaScript.
 */
export function SelectField({
  id,
  label,
  options,
  ...rest
}: {
  id: string;
  label: string;
  options: readonly SelectOption[];
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'>): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-overline-11 text-muted-text uppercase">
        {label}
      </label>
      <span className="relative flex">
        <select
          id={id}
          className="min-h-11 w-full appearance-none rounded-md border border-line bg-surface py-3 pr-10 pl-3.5 text-[15px] font-semibold"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
          <FeatureIcon name="bawah" size={18} />
        </span>
      </span>
    </div>
  );
}
