/**
 * Kapa, the Kawan Pasar mascot (v0.4, `kapaSVG(pose, 1)` in the prototype). Geometry is copied
 * exactly; frame 2 of the prototype (bob + gesture) is reproduced with CSS transforms.
 */
export const KAPA_POSES = [
  'halo',
  'menunjuk',
  'prediksi',
  'belajar',
  'waspada',
  'senang',
  'istirahat',
] as const;
export type KapaPose = (typeof KAPA_POSES)[number];

type Eyes = 'normal' | 'wide' | 'happy' | 'closed';
type Mouth = 'smile' | 'open' | 'o' | 'flat';
export type KapaProp = 'none' | 'chart' | 'mag' | 'alert' | 'zzz' | 'spark';

interface Arm {
  d: string;
  /** Shoulder as a transform-origin inside the arm's bounding box. */
  origin: string;
  /** Gesture rotation reached at the top of the bob (frame 2). */
  swingDeg: number;
}

export interface PoseSpec {
  armL: Arm;
  armR: Arm;
  eyes: Eyes;
  /** Horizontal gaze offset in px. */
  look: number;
  mouth: Mouth;
  prop: KapaProp;
  /** What the pose is for (v0.4 "Panduan Pose"). */
  use: string;
}

const LEFT_DOWN: Arm = { d: 'M26 124 C18 132 16 142 20 150', origin: '100% 0%', swingDeg: 0 };
const RIGHT_DOWN: Arm = { d: 'M134 124 C142 132 144 142 140 150', origin: '0% 0%', swingDeg: -4 };

export const POSES: Record<KapaPose, PoseSpec> = {
  halo: {
    armL: LEFT_DOWN,
    armR: { d: 'M134 120 C148 110 154 96 150 82', origin: '0% 100%', swingDeg: 12 },
    eyes: 'normal',
    look: 0,
    mouth: 'smile',
    prop: 'none',
    use: 'Sapaan, onboarding, hero Beranda',
  },
  menunjuk: {
    armL: LEFT_DOWN,
    armR: { d: 'M134 122 C146 120 156 116 166 110', origin: '0% 100%', swingDeg: 4 },
    eyes: 'normal',
    look: 3,
    mouth: 'smile',
    prop: 'none',
    use: 'Tips dan info ("Kata Kapa")',
  },
  prediksi: {
    armL: { d: 'M28 126 C34 140 46 148 56 150', origin: '0% 0%', swingDeg: 0 },
    armR: { d: 'M132 126 C126 140 114 148 104 150', origin: '100% 0%', swingDeg: 0 },
    eyes: 'normal',
    look: 0,
    mouth: 'smile',
    prop: 'chart',
    use: 'Konten ARIF-Net dan prediksi',
  },
  belajar: {
    armL: LEFT_DOWN,
    armR: { d: 'M134 124 C142 122 146 118 150 112', origin: '0% 100%', swingDeg: -6 },
    eyes: 'normal',
    look: 2,
    mouth: 'smile',
    prop: 'mag',
    use: 'Edukasi dan artikel',
  },
  waspada: {
    armL: LEFT_DOWN,
    armR: RIGHT_DOWN,
    eyes: 'wide',
    look: 0,
    mouth: 'o',
    prop: 'alert',
    use: 'Peringatan harga, gagal memuat',
  },
  senang: {
    armL: { d: 'M26 120 C14 108 10 94 14 82', origin: '100% 100%', swingDeg: -6 },
    armR: { d: 'M134 120 C146 108 150 94 146 82', origin: '0% 100%', swingDeg: 6 },
    eyes: 'happy',
    look: 0,
    mouth: 'open',
    prop: 'spark',
    use: 'Harga turun, aksi berhasil',
  },
  istirahat: {
    armL: LEFT_DOWN,
    armR: RIGHT_DOWN,
    eyes: 'closed',
    look: 0,
    mouth: 'flat',
    prop: 'zzz',
    use: 'Kosong, segera hadir, data belum tersedia',
  },
};

/** Natural size of the artwork (viewBox). */
export const KAPA_WIDTH = 180;
export const KAPA_HEIGHT = 196;
