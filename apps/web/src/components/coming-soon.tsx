import { ButtonLink, EmptyState } from '@kawan-pasar/ui';

import { Bakul } from '@/components/mascot/bakul';

/** Routes from docs 05 §5.2 that later phases fill; they explain themselves instead of 404. */
export function ComingSoon({
  title,
  phase,
  description,
}: {
  readonly title: string;
  readonly phase: string;
  readonly description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <EmptyState
        illustration={<Bakul pose="think" className="w-32" />}
        title="Segera hadir"
        description={description}
        action={
          <div className="flex flex-col items-center gap-3">
            <ButtonLink href="/rencana">Buka Rencana Menu</ButtonLink>
            <p className="text-sm text-text-secondary">Dikerjakan pada tahap {phase}.</p>
          </div>
        }
      />
    </div>
  );
}
