'use client';

// Atur Warung (docs 04 §3, ONB-01/02): warung type → menus and portions → alerts. No login; the
// data stays on this device and the last step says so.
import { StepItem } from '@kawan-pasar/ui';

import { StepAlerts, StepMenus, StepType } from './steps';
import { useOnboarding } from './use-onboarding';

const STEPS = ['Jenis warung', 'Menu & porsi', 'Peringatan'] as const;
const SCREENS = [StepType, StepMenus, StepAlerts] as const;

function stepState(index: number, current: number) {
  if (index < current) return 'done';
  return index === current ? 'current' : 'upcoming';
}

export function AturWarungScreen() {
  const flow = useOnboarding();
  const Screen = SCREENS[flow.step] ?? StepType;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Atur warung</h1>
        <p className="text-text-secondary">Dua menit, tanpa daftar akun.</p>
        <ol aria-label="Langkah" className="mt-2 flex flex-wrap gap-4">
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
      <Screen flow={flow} />
    </div>
  );
}
