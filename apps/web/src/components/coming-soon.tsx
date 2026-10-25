import { ButtonLink, EmptyState } from '@kawan-pasar/ui';

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
      <h1 className="text-2xl font-semibold">{title}</h1>
      <EmptyState
        title={`Segera hadir · ${phase}`}
        description={description}
        action={<ButtonLink href="/rencana">Buka Rencana Menu</ButtonLink>}
      />
    </div>
  );
}
