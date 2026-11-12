import type { ReactNode } from 'react';
import { SystemState } from '../organisms/SystemState';
import { PageContainer } from './SiteShell';

/** Temporary page for routes whose content arrives in Fase 1C (or a later phase). */
export function ComingSoonPage({ title }: { title: string }): ReactNode {
  return (
    <PageContainer className="flex flex-col gap-6 py-8 lg:py-14">
      <h1 className="text-heading-h3-24 lg:text-heading-h1-40">{title}</h1>
      <SystemState kind="coming_soon" />
    </PageContainer>
  );
}
