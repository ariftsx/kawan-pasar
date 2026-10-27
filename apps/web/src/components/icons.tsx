import { cn } from '@kawan-pasar/ui';

// Line icons drawn for Kawan Pasar on a 24 px grid. They follow the text colour (currentColor) and
// are always decorative: the visible label next to them carries the meaning.

export type IconName =
  'warung' | 'tag' | 'nota' | 'star' | 'more' | 'chevron-right' | 'chevron-left' | 'check';

function Paths({ name }: { readonly name: IconName }) {
  switch (name) {
    case 'warung': // Market stall with a scalloped awning.
      return (
        <>
          <path d="M3 9 5 4h14l2 5" />
          <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          <path d="M5 12v8M19 12v8M3 20h18M9.5 20v-4.5h5V20" />
        </>
      );
    case 'tag':
      return (
        <>
          <path d="M3 4.5v7.1l9.4 9.4 8.6-8.6L11.6 3H4.5A1.5 1.5 0 0 0 3 4.5Z" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </>
      );
    case 'nota': // Warung receipt with a torn bottom edge.
      return (
        <>
          <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21Z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      );
    case 'star':
      return (
        <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" />
      );
    case 'more':
      return (
        <>
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </>
      );
    case 'chevron-right':
      return <path d="m9 5 7 7-7 7" />;
    case 'chevron-left':
      return <path d="m15 5-7 7 7 7" />;
    case 'check':
      return <path d="m5 12.5 4.5 4.5L19 7.5" />;
  }
}

export function Icon({
  name,
  className,
}: {
  readonly name: IconName;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-6 shrink-0', className)}
    >
      <Paths name={name} />
    </svg>
  );
}
