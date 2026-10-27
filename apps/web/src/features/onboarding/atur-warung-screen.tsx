'use client';

// Atur Warung (docs 04 §3, ONB-01/02): warung type → menus and portions → alerts. No login; the
// data stays on this device and the last step says so.
import { StepItem } from '@kawan-pasar/ui';

import { BakulSays } from '@/components/mascot/bakul-says';

import { StepAlerts, StepMenus, StepType } from './steps';
import { useOnboarding } from './use-onboarding';

import type { BakulPose } from '@/components/mascot/bakul';

const STEPS = ['Jenis warung', 'Menu & porsi', 'Peringatan'] as const;
const SCREENS = [StepType, StepMenus, StepAlerts] as const;

// What Si Bakul says on each step: the one hint the step needs, in plain words.
const GUIDE: readonly { pose: BakulPose; text: string }[] = [
  { pose: 'point', text: 'Pilih jenis warung Anda. Saya siapkan contoh menunya.' },
  { pose: 'point', text: 'Takaran bahan sudah saya isi. Anda cukup atur porsi per hari.' },
  { pose: 'happy', text: 'Sedikit lagi! Tekan tombol hijau untuk melihat modal menu Anda.' },
];

function stepState(index: number, current: number) {
  if (index < current) return 'done';
  return index === current ? 'current' : 'upcoming';
}

export function AturWarungScreen() {
  const flow = useOnboarding();
  const Screen = SCREENS[flow.step] ?? StepType;
  const guide = GUIDE[flow.step] ?? GUIDE[0];
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Atur warung</h1>
        <p className="text-lg text-text-secondary">Dua menit, tanpa daftar akun.</p>
        <ol aria-label="Langkah" className="mt-2 flex flex-wrap gap-x-5 gap-y-3">
          {STEPS.map((label, index) => (
            <StepItem
              key={label}
              index={index + 1}
              label={label}
              state={stepState(index, flow.step)}
            />
          ))}
        </ol>
      </header>
      {guide === undefined ? null : (
        <BakulSays key={flow.step} pose={guide.pose} isAnimated>
          {guide.text}
        </BakulSays>
      )}
      <Screen flow={flow} />
    </div>
  );
}
