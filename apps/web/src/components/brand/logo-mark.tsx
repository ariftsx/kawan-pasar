import { cn } from '@kawan-pasar/ui';

// Logo Kawan Pasar v0.4: a cream market basket under a rising price line that ends in a forecast
// dot, on a deep-green tile. Colours come from the `illustration.*` tokens.

export function LogoMark({
  className,
  title,
}: {
  readonly className?: string;
  /** Leave out when the visible "Kawan Pasar" wordmark sits next to the mark. */
  readonly title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-auto shrink-0', className)}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      <rect className="fill-illustration-brand" width="48" height="48" rx="14" />
      <path
        className="fill-illustration-cream"
        d="M9 26.5H39C39 34.8 32.3 40.5 24 40.5C15.7 40.5 9 34.8 9 26.5Z"
      />
      <path
        className="stroke-illustration-kunyit"
        d="M12.5 21.5L19 15.5L25 19L33.5 9.5"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle className="fill-illustration-kunyit" cx="34.5" cy="9.2" r="3.4" />
      <path
        className="stroke-illustration-brand"
        d="M14 30.5C17.5 33.5 30.5 33.5 34 30.5"
        strokeOpacity="0.18"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
