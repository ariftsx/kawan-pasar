import { cn } from '@kawan-pasar/ui';

// Spot illustrations for the three setup steps, drawn in Si Bakul's style: warm fills, a dark
// bamboo outline, and everyday warung objects. Always decorative; the step text says the same.

export type SpotName = 'warung' | 'piring' | 'nota';

const OUTLINE = 'stroke-illustration-outline';
const LINE = { strokeWidth: 3.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

function KerupukJar({ x }: { readonly x: number }) {
  return (
    <>
      <rect
        x={x}
        y="48"
        width="20"
        height="18"
        rx="3"
        className={cn('fill-illustration-shine', OUTLINE)}
        {...LINE}
      />
      <rect
        x={x - 1}
        y="43"
        width="22"
        height="6"
        rx="2"
        className={cn('fill-illustration-chili', OUTLINE)}
        {...LINE}
      />
      <circle cx={x + 7} cy="57" r="4" className="fill-illustration-bamboo" />
      <circle cx={x + 13} cy="60" r="3.5" className="fill-illustration-weave" />
    </>
  );
}

/** Warung stall: striped awning, two jars of kerupuk on the counter. */
function Warung() {
  const stripes = [10, 30, 50, 70, 90];
  return (
    <>
      <rect x="18" y="34" width="84" height="46" className="fill-illustration-rice" />
      {stripes.map((x, index) => (
        <path
          key={x}
          d={`M${String(x)} 14 h20 v18 a10 10 0 0 1 -20 0 Z`}
          className={cn(
            index % 2 === 0 ? 'fill-illustration-chili' : 'fill-illustration-rice',
            OUTLINE,
          )}
          {...LINE}
        />
      ))}
      <path
        d="M14 14 L22 5 H98 L106 14 Z"
        className={cn('fill-illustration-rim', OUTLINE)}
        {...LINE}
      />
      <path d="M20 42 V80 M100 42 V80" className={OUTLINE} {...LINE} />
      <KerupukJar x={34} />
      <KerupukJar x={60} />
      <rect
        x="10"
        y="66"
        width="100"
        height="22"
        rx="3"
        className={cn('fill-illustration-bamboo', OUTLINE)}
        {...LINE}
      />
      <path
        d="M22 77 H98"
        className="stroke-illustration-weave"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="8 7"
      />
    </>
  );
}

/** Enamel plate with rice, fried chicken, sambal, and cucumber: one portion. */
function Piring() {
  return (
    <>
      <path
        d="M44 22 q4 -6 0 -12 M60 20 q4 -6 0 -12 M76 22 q4 -6 0 -12"
        fill="none"
        className="stroke-illustration-weave"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <ellipse
        cx="60"
        cy="66"
        rx="52"
        ry="24"
        className={cn('fill-illustration-leaf-light', OUTLINE)}
        {...LINE}
      />
      <ellipse cx="60" cy="63" rx="42" ry="17" className="fill-illustration-shine" />
      <path
        d="M26 64 C26 36 62 36 62 64 Z"
        className={cn('fill-illustration-rice', OUTLINE)}
        {...LINE}
      />
      <path
        d="M64 62 C58 50 66 38 80 40 C92 42 96 54 88 62 Z"
        className={cn('fill-illustration-weave', OUTLINE)}
        {...LINE}
      />
      <path
        d="M71 50 l4 -3 M80 47 l3 3 M77 55 l4 -2"
        className="stroke-illustration-rim"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx="94" cy="66" r="7" className={cn('fill-illustration-chili', OUTLINE)} {...LINE} />
      <ellipse
        cx="44"
        cy="70"
        rx="7"
        ry="4"
        className={cn('fill-illustration-leaf-light', OUTLINE)}
        strokeWidth={2.5}
      />
      <ellipse
        cx="56"
        cy="72"
        rx="7"
        ry="4"
        className={cn('fill-illustration-leaf-light', OUTLINE)}
        strokeWidth={2.5}
      />
    </>
  );
}

/** Warung receipt with a coin stack: the cost per portion. */
function Nota() {
  return (
    <>
      <path
        d="M24 8 H76 V88 l-6.5 -5 -6.5 5 -6.5 -5 -6.5 5 -6.5 -5 -6.5 5 -6.5 -5 -6.5 5 Z"
        className={cn('fill-illustration-rice', OUTLINE)}
        {...LINE}
      />
      <text x="32" y="36" className="fill-illustration-ink text-xl font-bold">
        Rp
      </text>
      <path
        d="M32 50 H68 M32 60 H60 M32 70 H64"
        className="stroke-illustration-weave"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {[78, 70, 62].map((y) => (
        <g key={y}>
          <path
            d={`M78 ${String(y)} v6 a16 6 0 0 0 32 0 v-6`}
            className={cn('fill-illustration-rim', OUTLINE)}
            {...LINE}
          />
          <ellipse
            cx="94"
            cy={y}
            rx="16"
            ry="6"
            className={cn('fill-illustration-rim-light', OUTLINE)}
            {...LINE}
          />
        </g>
      ))}
    </>
  );
}

export function Spot({
  name,
  className,
}: {
  readonly name: SpotName;
  readonly className?: string;
}) {
  return (
    <svg viewBox="0 0 120 96" aria-hidden="true" className={cn('h-auto', className)}>
      {name === 'warung' ? <Warung /> : null}
      {name === 'piring' ? <Piring /> : null}
      {name === 'nota' ? <Nota /> : null}
    </svg>
  );
}
