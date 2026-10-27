import { cn } from '@kawan-pasar/ui';

// The Kawan Pasar logo: Si Bakul reduced to a mark. A bamboo basket with a woven rim and a quiet
// smile carries a curly red chilli and a shallot. Colours come from the `illustration.*` tokens,
// like the mascot, and read on both themes. The favicon (src/app/icon.svg, favicon.ico) is a
// chunkier cut of the same drawing, because the rim dashes and shallot lines vanish below 48 px.

export type LogoMarkProps = {
  /** Read by screen readers; leave it out when the name is written next to the mark. */
  readonly title?: string;
  readonly className?: string;
};

const CHILI =
  'M54.03 52.41 C45.3 84.26 77.34 93.47 83.66 109.76 L104.34 102.24 C95.04 74.86 75.12 68.33 77.97 59.59 A12.5 12.5 0 0 0 54.03 52.41 Z';
const CALYX =
  'M42.44 45.01 A26 26 0 0 1 89.56 45.01 A5 5 0 0 1 80.5 49.24 A16 16 0 0 0 51.5 49.24 A5 5 0 0 1 42.44 45.01 Z ' +
  'M70.91 31.94 L78.91 19.94 A3.5 3.5 0 0 0 73.09 16.06 L65.09 28.06 A3.5 3.5 0 0 0 70.91 31.94 Z';
const SHALLOT =
  'M172 42 C176.55 53.7 185.42 56.49 191.92 64.29 A26 26 0 1 1 152.08 64.29 C158.58 56.49 167.45 53.7 172 42 Z';
const SHALLOT_LINES =
  'M161.86 91.63 A48.8 48.8 0 0 1 161.86 66.37 A2.8 2.8 0 0 1 167.27 67.82 A43.2 43.2 0 0 0 167.27 90.18 A2.8 2.8 0 0 1 161.86 91.63 Z ' +
  'M182.14 66.37 A48.8 48.8 0 0 1 182.14 91.63 A2.8 2.8 0 0 1 176.73 90.18 A43.2 43.2 0 0 0 176.73 67.82 A2.8 2.8 0 0 1 182.14 66.37 Z ' +
  'M174.76 46.61 L181.76 34.61 A3.2 3.2 0 0 0 176.24 31.39 L169.24 43.39 A3.2 3.2 0 0 0 174.76 46.61 Z';
const BODY = 'M44 160 H212 C208 206 188 238 152 240 H104 C68 238 48 206 44 160 Z';
const SMILE =
  'M155.03 209.93 A33 33 0 0 1 100.97 209.93 A7 7 0 0 1 112.44 201.9 A19 19 0 0 0 143.56 201.9 A7 7 0 0 1 155.03 209.93 Z';

// Woven rim: seven short dashes, the same rhythm as the mascot's rim.
const RIM_DASHES = [46, 70, 94, 118, 142, 166, 190] as const;

/** The logo symbol as inline SVG; it scales with its box (set a width with `className`). */
export function LogoMark({ title, className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={cn('h-auto', className)}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      <path d={CHILI} className="fill-illustration-chili" />
      <path d={CALYX} className="fill-illustration-leaf" />
      <path d={SHALLOT} className="fill-illustration-shallot" />
      <path d={SHALLOT_LINES} className="fill-illustration-shallot-line" />
      <rect x="28" y="118" width="200" height="30" rx="15" className="fill-illustration-rim" />
      {RIM_DASHES.map((x) => (
        <rect
          key={x}
          x={x}
          y="130"
          width="14"
          height="6"
          rx="3"
          className="fill-illustration-bamboo"
        />
      ))}
      <path d={BODY} className="fill-illustration-bamboo" />
      <circle cx="100" cy="188" r="10" className="fill-illustration-ink" />
      <circle cx="156" cy="188" r="10" className="fill-illustration-ink" />
      <path d={SMILE} className="fill-illustration-ink" />
    </svg>
  );
}
