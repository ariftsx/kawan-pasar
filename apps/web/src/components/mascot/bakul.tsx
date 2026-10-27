import { cn } from '@kawan-pasar/ui';

import type { ReactNode } from 'react';

// Si Bakul, the Kawan Pasar mascot: a woven bamboo rice basket ("bakul" is also Javanese for a
// market trader) carrying the three tracked commodities: rice, curly red chilli, and shallot.
// Colours come from the `illustration.*` tokens, so there are no hex values here.

export type BakulPose = 'wave' | 'point' | 'think' | 'happy' | 'rest';

export type BakulProps = {
  readonly pose?: BakulPose;
  /** Read by screen readers; leave it out when the mascot only decorates nearby text. */
  readonly title?: string;
  /** Blinks and waves, only when the device does not ask for reduced motion. */
  readonly isAnimated?: boolean;
  /** `mark` drops arms, feet, and shadow for the logo. */
  readonly variant?: 'full' | 'mark';
  readonly className?: string;
};

const OUTLINE = 'stroke-illustration-outline';
const ROUND = { strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** A thick stroke with an outline: the same path drawn twice, outline first. */
function Tube({ d, width, className }: { d: string; width: number; className: string }) {
  return (
    <>
      <path d={d} fill="none" className={OUTLINE} strokeWidth={width + 9} {...ROUND} />
      <path d={d} fill="none" className={className} strokeWidth={width} {...ROUND} />
    </>
  );
}

function Contents() {
  return (
    <>
      <path
        d="M52 106 C52 52 188 52 188 106 Z"
        className={cn('fill-illustration-rice', OUTLINE)}
        strokeWidth={5}
        {...ROUND}
      />
      <g className="fill-illustration-grain">
        <ellipse cx="104" cy="74" rx="4.5" ry="2.4" transform="rotate(-25 104 74)" />
        <ellipse cx="124" cy="66" rx="4.5" ry="2.4" transform="rotate(10 124 66)" />
        <ellipse cx="116" cy="86" rx="4.5" ry="2.4" transform="rotate(35 116 86)" />
        <ellipse cx="136" cy="80" rx="4.5" ry="2.4" transform="rotate(-15 136 80)" />
      </g>
      <Tube
        d="M92 100 C86 82 70 76 66 60 C62 46 70 38 62 28"
        width={8}
        className="stroke-illustration-chili"
      />
      <path
        d="M76 70 C72 64 70 58 70 52"
        fill="none"
        className="stroke-illustration-chili-shine"
        strokeWidth={2.5}
        {...ROUND}
      />
      <path
        d="M54 30 C58 22 70 22 72 30 C66 27 60 27 54 30 Z"
        className={cn('fill-illustration-leaf', OUTLINE)}
        strokeWidth={4}
        {...ROUND}
      />
      <Tube d="M63 25 C62 18 66 12 72 10" width={3.5} className="stroke-illustration-leaf" />
      <path
        d="M162 44 C166 58 184 64 184 82 C184 98 140 98 140 82 C140 64 158 58 162 44 Z"
        className={cn('fill-illustration-shallot', OUTLINE)}
        strokeWidth={5}
        {...ROUND}
      />
      <path
        d="M162 50 C158 62 152 70 152 84 M162 50 C166 62 172 70 172 84"
        fill="none"
        className="stroke-illustration-shallot-line"
        strokeWidth={2.5}
        {...ROUND}
      />
      <path
        d="M148 70 C147 76 147 80 148 84"
        fill="none"
        className="stroke-illustration-shallot-shine"
        strokeWidth={3}
        {...ROUND}
      />
      <Tube d="M162 44 L160 36 M162 44 L166 37" width={2} className="stroke-illustration-weave" />
    </>
  );
}

const BODY = 'M42 108 C42 108 44 186 70 212 C88 230 152 230 170 212 C196 186 198 108 198 108 Z';

// Basket weave: three bands and short uprights, kept clear of the face.
const WEAVE =
  'M45 138 Q120 150 195 138 M48 168 Q120 180 192 168 M58 198 Q120 210 182 198 ' +
  'M62 123 V133 M90 123 V133 M118 123 V133 M146 123 V133 M174 123 V133 M50 151 V163 ' +
  'M190 151 V163 M62 179 V193 M178 179 V193 M86 207 V219 M110 208 V220 M134 208 V220 M158 207 V219';

function Body() {
  return (
    <>
      <path d={BODY} className="fill-illustration-bamboo" />
      <path
        d={WEAVE}
        fill="none"
        className="stroke-illustration-weave"
        strokeWidth={3}
        {...ROUND}
      />
      <path d={BODY} fill="none" className={OUTLINE} strokeWidth={5} {...ROUND} />
      <rect
        x="32"
        y="96"
        width="176"
        height="24"
        rx="12"
        className={cn('fill-illustration-rim', OUTLINE)}
        strokeWidth={5}
      />
      <path
        d="M44 104 H196"
        className="stroke-illustration-rim-light"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="10 9"
      />
    </>
  );
}

function Line({ d, width }: { d: string; width: number }) {
  return (
    <path d={d} fill="none" className="stroke-illustration-ink" strokeWidth={width} {...ROUND} />
  );
}

function Mouth({ pose }: { pose: BakulPose }) {
  if (pose === 'think') return <Line d="M110 176 Q118 172 130 175" width={4.5} />;
  if (pose !== 'wave' && pose !== 'happy') {
    return <Line d="M106 170 Q120 182 134 170" width={4.5} />;
  }
  return <OpenMouth />;
}

function OpenMouth() {
  return (
    <>
      <path
        d="M104 168 Q120 168 136 168 Q134 186 120 186 Q106 186 104 168 Z"
        className="fill-illustration-ink stroke-illustration-ink"
        strokeWidth={3}
        {...ROUND}
      />
      <path
        d="M111 180 Q120 174 129 180 Q126 185 120 185 Q114 185 111 180 Z"
        className="fill-illustration-tongue"
      />
    </>
  );
}

function Eyes({ pose, isAnimated }: { pose: BakulPose; isAnimated: boolean }) {
  if (pose === 'happy')
    return <Line d="M88 152 Q97 142 106 152 M134 152 Q143 142 152 152" width={5} />;
  return (
    <g
      className={cn(
        'transform-fill origin-center',
        isAnimated && 'motion-safe:animate-bakul-blink',
      )}
    >
      <ellipse cx="97" cy="150" rx="7" ry="9" className="fill-illustration-ink" />
      <ellipse cx="143" cy="150" rx="7" ry="9" className="fill-illustration-ink" />
      <circle cx="99.5" cy="146" r="2.6" className="fill-illustration-shine" />
      <circle cx="145.5" cy="146" r="2.6" className="fill-illustration-shine" />
    </g>
  );
}

function Face({ pose, isAnimated }: { pose: BakulPose; isAnimated: boolean }) {
  const brows =
    pose === 'think'
      ? 'M86 132 Q96 128 106 134 M134 130 Q144 124 154 128'
      : 'M88 134 Q97 128 106 133 M134 133 Q143 128 152 134';
  return (
    <>
      <Line d={brows} width={4} />
      <Eyes pose={pose} isAnimated={isAnimated} />
      <ellipse cx="80" cy="170" rx="10" ry="6" className="fill-illustration-cheek" />
      <ellipse cx="160" cy="170" rx="10" ry="6" className="fill-illustration-cheek" />
      <Mouth pose={pose} />
    </>
  );
}

function Arm({ d, hand }: { d: string; hand: readonly [number, number] }) {
  return (
    <>
      <Tube d={d} width={6} className="stroke-illustration-rim" />
      <circle
        cx={hand[0]}
        cy={hand[1]}
        r="10"
        className={cn('fill-illustration-bamboo', OUTLINE)}
        strokeWidth={5}
      />
    </>
  );
}

const LEFT_DOWN = <Arm d="M46 160 Q30 172 26 188" hand={[26, 190]} />;
const RIGHT: ReadonlyMap<BakulPose, ReactNode> = new Map<BakulPose, ReactNode>([
  ['rest', <Arm key="rest" d="M194 160 Q210 172 214 188" hand={[214, 190]} />],
  ['wave', <Arm key="wave" d="M194 150 Q214 134 218 108" hand={[218, 104]} />],
  ['point', <Arm key="point" d="M194 158 Q210 152 220 140" hand={[222, 138]} />],
  ['think', <Arm key="think" d="M196 170 Q190 206 160 204" hand={[154, 202]} />],
  ['happy', <Arm key="happy" d="M194 150 Q214 134 218 112" hand={[218, 108]} />],
]);

function Limbs({ pose, isAnimated }: { pose: BakulPose; isAnimated: boolean }) {
  return (
    <>
      <ellipse
        cx="94"
        cy="226"
        rx="17"
        ry="9"
        className={cn('fill-illustration-rim', OUTLINE)}
        strokeWidth={5}
      />
      <ellipse
        cx="146"
        cy="226"
        rx="17"
        ry="9"
        className={cn('fill-illustration-rim', OUTLINE)}
        strokeWidth={5}
      />
      {pose === 'happy' ? <Arm d="M46 150 Q26 134 22 112" hand={[22, 108]} /> : LEFT_DOWN}
      <g
        className={cn(
          'transform-fill origin-bottom-left',
          pose === 'wave' && isAnimated && 'motion-safe:animate-bakul-wave',
        )}
      >
        {pose === 'think' ? null : RIGHT.get(pose)}
      </g>
    </>
  );
}

/** The mascot as inline SVG; it scales with its box (set a width with `className`). */
export function Bakul({
  pose = 'rest',
  title,
  isAnimated = false,
  variant = 'full',
  className,
}: BakulProps) {
  const isMark = variant === 'mark';
  return (
    <svg
      viewBox={isMark ? '26 4 188 232' : '0 0 240 250'}
      className={cn('h-auto', className)}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      {isMark ? null : (
        <ellipse cx="120" cy="238" rx="66" ry="7" className="fill-illustration-ink/10" />
      )}
      {isMark ? null : <Limbs pose={pose} isAnimated={isAnimated} />}
      <Contents />
      <Body />
      <Face pose={pose} isAnimated={isAnimated} />
      {!isMark && pose === 'think' ? RIGHT.get('think') : null}
    </svg>
  );
}
