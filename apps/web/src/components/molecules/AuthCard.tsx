import type { ReactNode } from 'react';
import { Kapa } from '@/brand/Kapa';
import type { KapaPose } from '@/brand/kapa-poses';
import { PageContainer } from '../templates/SiteShell';

/**
 * Narrow form card for the sign-in pages (no prototype screen exists; built from the v0.4
 * tokens): title, short lead, Kapa (decorative), then the form and the links below it.
 */
export function AuthCard({
  title,
  lead,
  pose,
  children,
  footer,
}: {
  title: string;
  lead?: string;
  pose: KapaPose;
  children: ReactNode;
  footer?: ReactNode;
}): ReactNode {
  return (
    <PageContainer className="flex justify-center py-8 sm:py-14">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-heading-h3-24 text-balance">{title}</h1>
            {lead === undefined ? null : <p className="text-body-medium-15 text-ink-2">{lead}</p>}
          </div>
          <Kapa pose={pose} size={84} className="shrink-0" />
        </div>
        {children}
        {footer === undefined ? null : (
          <div className="border-t border-line pt-5 text-center text-body-small-13">{footer}</div>
        )}
      </div>
    </PageContainer>
  );
}
