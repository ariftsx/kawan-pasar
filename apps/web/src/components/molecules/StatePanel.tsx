import type { ReactNode } from 'react';
import { Kapa } from '@/brand/Kapa';
import type { KapaPose } from '@/brand/kapa-poses';
import { KapaMotion } from '@/brand/KapaMotion';
import type { ChipTone } from '../atoms/Chip';
import { Chip } from '../atoms/Chip';

/**
 * Empty/error/coming-soon panel (v0.4 "6 status"). Kapa sets the mood; the title and body carry
 * the meaning, so Kapa stays decorative.
 */
export function StatePanel({
  pose,
  chip,
  chipTone = 'terong',
  title,
  body,
  action,
  headingLevel = 2,
}: {
  pose: KapaPose;
  chip: string;
  chipTone?: ChipTone;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  headingLevel?: 1 | 2;
}): ReactNode {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-5 text-center sm:p-6">
      <div className="flex w-full justify-center rounded-xl bg-terong-100 py-6">
        <KapaMotion>
          <Kapa pose={pose} size={140} />
        </KapaMotion>
      </div>
      <Chip tone={chipTone} size="S">
        {chip}
      </Chip>
      <Heading className="text-heading-title-20 text-balance">{title}</Heading>
      <div className="text-body-medium-15 max-w-md text-ink-2">{body}</div>
      {action}
    </section>
  );
}
