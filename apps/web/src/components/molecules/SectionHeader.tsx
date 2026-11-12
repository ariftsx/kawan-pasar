import type { ReactNode } from 'react';

/** Section title with description and an optional action on the right (v0.4 SectionHeader). */
export function SectionHeader({
  title,
  description,
  action,
  as: Heading = 'h2',
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  as?: 'h1' | 'h2';
  id?: string;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Heading id={id} className="text-heading-h3-24 sm:text-heading-h2-32 text-balance">
          {title}
        </Heading>
        {description === undefined ? null : (
          <p className="text-body-small-13 sm:text-body-medium-15 text-ink-2">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
