import type { CSSProperties, ReactNode } from 'react';
import './kapa.css';
import { KAPA_HEIGHT, KAPA_WIDTH, POSES } from './kapa-poses';
import type { KapaPose, KapaProp, PoseSpec } from './kapa-poses';

// Mascot artwork colours (v0.4 assets.mjs). They belong to the illustration, not to UI tokens.
const INK = '#14201A';
const RED = '#E04535';
const DARK = '#B23628';
const G1 = '#2E9E5B';
const G2 = '#17865A';
const T = '#6A4BD6';
const T1 = '#EEE9FD';
const K = '#F0A92E';
const SH = '#B8325E';

const LINE = { stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round', fill: 'none' } as const;

function Eyes({ eyes, look }: Pick<PoseSpec, 'eyes' | 'look'>): ReactNode {
  if (eyes === 'closed') {
    return (
      <g>
        <path
          d={`M${String(57 + look)} 117 Q${String(64 + look)} 121 ${String(71 + look)} 117`}
          {...LINE}
        />
        <path
          d={`M${String(89 + look)} 117 Q${String(96 + look)} 121 ${String(103 + look)} 117`}
          {...LINE}
        />
      </g>
    );
  }
  if (eyes === 'happy') {
    return (
      <g>
        <path d="M57 119 Q64 110 71 119" {...LINE} />
        <path d="M89 119 Q96 110 103 119" {...LINE} />
      </g>
    );
  }
  const rx = eyes === 'wide' ? 8 : 6.5;
  const ry = eyes === 'wide' ? 9.5 : 8.5;
  return (
    <g className="kapa-eyes">
      <ellipse cx={64 + look} cy={116} rx={rx} ry={ry} fill={INK} />
      <ellipse cx={96 + look} cy={116} rx={rx} ry={ry} fill={INK} />
      <circle cx={66.5 + look} cy={112.5} r={2.4} fill="#fff" />
      <circle cx={98.5 + look} cy={112.5} r={2.4} fill="#fff" />
    </g>
  );
}

function Mouth({ mouth }: Pick<PoseSpec, 'mouth'>): ReactNode {
  switch (mouth) {
    case 'smile':
      return <path d="M70 134 Q80 143 90 134" {...LINE} />;
    case 'open':
      return <path d="M68 132 Q80 150 92 132 Z" fill={INK} />;
    case 'o':
      return <ellipse cx={80} cy={138} rx={5} ry={6} fill={INK} />;
    case 'flat':
      return <path d="M74 136 L86 136" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />;
  }
}

function Prop({ prop }: { prop: KapaProp }): ReactNode {
  switch (prop) {
    case 'none':
      return null;
    case 'chart':
      return (
        <g data-kapa-prop="chart">
          <rect
            x={48}
            y={132}
            width={64}
            height={44}
            rx={9}
            fill="#FFFFFF"
            stroke="#E8E2D6"
            strokeWidth={2}
          />
          <path
            d="M56 166 L67 158 L77 162 L91 148"
            stroke={G2}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M91 148 L103 141"
            stroke={T}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeDasharray="3 4"
            fill="none"
          />
          <circle cx={104} cy={140.5} r={3.6} fill={T} />
        </g>
      );
    case 'mag':
      return (
        <g data-kapa-prop="mag" className="kapa-prop-float">
          <path d="M150 112 L141 124" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <circle cx={158} cy={100} r={13} fill={T1} stroke={INK} strokeWidth={4} />
        </g>
      );
    case 'alert':
      return (
        <g data-kapa-prop="alert" className="kapa-prop-float">
          <circle cx={144} cy={40} r={15} fill={K} />
          <rect x={141.5} y={29} width={5} height={14} rx={2.5} fill="#fff" />
          <circle cx={144} cy={49} r={2.8} fill="#fff" />
        </g>
      );
    case 'zzz':
      return (
        <g data-kapa-prop="zzz" className="kapa-prop-float kapa-prop-pulse">
          <path
            d="M118 52 H130 L118 64 H130"
            stroke={T}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M136 30 H144 L136 38 H144"
            stroke={T}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.6}
          />
        </g>
      );
    case 'spark':
      return (
        <g data-kapa-prop="spark" className="kapa-prop-pulse">
          <path d="M150 50 L153 59 L162 62 L153 65 L150 74 L147 65 L138 62 L147 59 Z" fill={K} />
          <path d="M14 52 L16 58 L22 60 L16 62 L14 68 L12 62 L6 60 L12 58 Z" fill={K} />
          <circle cx={130} cy={30} r={3} fill={T} />
          <circle cx={30} cy={34} r={3} fill={G1} />
        </g>
      );
  }
}

const armStyle = (origin: string, swingDeg: number): CSSProperties =>
  ({ '--kapa-origin': origin, '--kapa-swing': `${String(swingDeg)}deg` }) as CSSProperties;

export interface KapaProps {
  pose: KapaPose;
  /** Rendered width in px; clamped to the v0.4 range 84–200. */
  size: number;
  /** When Kapa conveys a status, describe it here; otherwise Kapa is decorative. */
  label?: string;
  className?: string;
}

/**
 * Server component. The animation (float, gesture, blink) is pure CSS and only runs inside an
 * on-screen <KapaMotion>, never under prefers-reduced-motion.
 */
export function Kapa({ pose, size, label, className }: KapaProps): ReactNode {
  const p = POSES[pose];
  const width = Math.min(200, Math.max(84, Math.round(size)));
  const height = Math.round((width * KAPA_HEIGHT) / KAPA_WIDTH);
  const a11y =
    label === undefined
      ? ({ 'aria-hidden': true, focusable: false } as const)
      : ({ role: 'img', 'aria-label': label } as const);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${String(KAPA_WIDTH)} ${String(KAPA_HEIGHT)}`}
      xmlns="http://www.w3.org/2000/svg"
      className={['kapa', className].filter(Boolean).join(' ')}
      data-pose={pose}
      {...a11y}
    >
      {label === undefined ? null : <title>{label}</title>}
      <ellipse className="kapa-shadow" cx={90} cy={190} rx={44} ry={5} fill={INK} opacity={0.09} />
      <g transform="translate(10,6)">
        <g className="kapa-rig">
          <g>
            <ellipse cx={64} cy={178} rx={13} ry={6} fill={DARK} />
            <ellipse cx={96} cy={178} rx={13} ry={6} fill={DARK} />
          </g>
          <path
            className="kapa-arm"
            style={armStyle(p.armL.origin, p.armL.swingDeg)}
            d={p.armL.d}
            stroke={DARK}
            strokeWidth={9}
            strokeLinecap="round"
            fill="none"
          />
          <g className="kapa-leaf">
            <path d="M80 38 L80 26" stroke={G2} strokeWidth={4} strokeLinecap="round" />
            <path d="M80 34 C70 14 54 8 46 13 C55 18 66 26 80 34Z" fill={G1} />
            <path d="M80 34 C86 10 103 3 112 8 C102 15 90 23 80 34Z" fill={G2} />
          </g>
          <g>
            <path
              d="M80 30 C93 52 140 72 140 120 C140 155 113 176 80 176 C47 176 20 155 20 120 C20 72 67 52 80 30Z"
              fill={RED}
            />
            <path
              d="M80 46 C70 74 68 140 74 172"
              stroke={SH}
              strokeOpacity={0.22}
              strokeWidth={2.5}
              fill="none"
            />
            <path
              d="M80 46 C92 74 94 140 88 172"
              stroke={SH}
              strokeOpacity={0.16}
              strokeWidth={2.5}
              fill="none"
            />
            <path
              d="M42 104 C44 88 52 76 62 69"
              stroke="#fff"
              strokeOpacity={0.35}
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
            />
          </g>
          <g>
            <Eyes eyes={p.eyes} look={p.look} />
            <g>
              <ellipse cx={50} cy={130} rx={8} ry={5} fill="#FF9C8C" opacity={0.85} />
              <ellipse cx={110} cy={130} rx={8} ry={5} fill="#FF9C8C" opacity={0.85} />
            </g>
            <Mouth mouth={p.mouth} />
          </g>
          <path
            className="kapa-arm"
            style={armStyle(p.armR.origin, p.armR.swingDeg)}
            d={p.armR.d}
            stroke={DARK}
            strokeWidth={9}
            strokeLinecap="round"
            fill="none"
          />
          <Prop prop={p.prop} />
        </g>
      </g>
    </svg>
  );
}
