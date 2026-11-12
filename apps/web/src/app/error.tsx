'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { SystemState } from '@/components/organisms/SystemState';
import { PageContainer } from '@/components/templates/SiteShell';

/**
 * Route error boundary. Upstream failures are thrown on purpose (requireData) so ISR keeps the
 * last good page; a visitor without any cached page lands here. No error detail is shown.
 *
 * "Coba lagi" must fetch a fresh server render: `reset()` alone re-renders the RSC payload the
 * client already holds, which still contains the error.
 */
export default function RouteError({ reset }: { error: Error; reset: () => void }): ReactNode {
  const router = useRouter();
  return (
    <PageContainer className="py-8 lg:py-14">
      <SystemState
        kind="load_failed"
        headingLevel={1}
        retry={
          <Button
            onClick={() => {
              startTransition(() => {
                router.refresh();
                reset();
              });
            }}
          >
            Coba lagi
          </Button>
        }
      />
    </PageContainer>
  );
}
