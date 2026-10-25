import { cn } from '../cn.js';

/** Required on every sample number (docs 10 §8.4); its text cannot be changed by callers. */
export function DemoBadge({ className }: { readonly className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm bg-demo-bg px-2 py-0.5 text-xs font-semibold text-demo-fg',
        className,
      )}
    >
      DATA DEMO
    </span>
  );
}
