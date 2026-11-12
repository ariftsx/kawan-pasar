'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '../atoms/Button';

/** "Coba lagi" for the load-failed state: re-renders the current route on the server. */
export function RetryButton(): ReactNode {
  const router = useRouter();
  return (
    <Button
      variant="brand"
      onClick={() => {
        router.refresh();
      }}
    >
      Coba lagi
    </Button>
  );
}
