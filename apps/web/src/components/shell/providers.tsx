'use client';

import { useRouter } from 'next/navigation';
import { RouterProvider } from 'react-aria-components';

import type { ReactNode } from 'react';

/** React Aria links navigate client-side through the Next router. */
export function Providers({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(href) => {
        router.push(href);
      }}
    >
      {children}
    </RouterProvider>
  );
}
