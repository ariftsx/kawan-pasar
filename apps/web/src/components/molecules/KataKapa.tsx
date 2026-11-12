import type { ReactNode } from 'react';
import { Kapa } from '@/brand/Kapa';
import type { KapaPose } from '@/brand/kapa-poses';
import { KapaMotion } from '@/brand/KapaMotion';
import { Chip } from '../atoms/Chip';

/** Tip card from Kapa (v0.4 KataKapa). Copy must stay non-causal and give no buy/sell advice. */
export function KataKapa({
  title,
  body,
  action,
  pose = 'menunjuk',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  pose?: KapaPose;
}): ReactNode {
  return (
    <aside className="flex items-end gap-3 rounded-xl bg-kunyit-100 p-5">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <Chip tone="kunyit-solid" size="S">
          Kata Kapa
        </Chip>
        <p className="text-heading-card-16 font-extrabold">{title}</p>
        <p className="text-body-small-13 text-ink-2">{body}</p>
        {action}
      </div>
      <KapaMotion>
        <Kapa pose={pose} size={96} />
      </KapaMotion>
    </aside>
  );
}
