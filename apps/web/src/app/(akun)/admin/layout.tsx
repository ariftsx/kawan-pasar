import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminTabs } from '@/components/organisms/admin/AdminTabs';
import { PageContainer } from '@/components/templates/SiteShell';
import { adminContext } from '@/lib/admin/context';

export const metadata: Metadata = { title: 'Admin' };

/** Admin area (Fase 3B): admins only (others get a 404), private, never indexed. */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  // Access check for every admin page (not an admin → 404).
  await adminContext();
  return (
    <PageContainer className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-overline-11 text-muted-text uppercase">Admin</p>
          <h1 className="text-heading-h2-32">Pengelolaan Kawan Pasar</h1>
        </div>
      </div>
      <AdminTabs />
      {children}
    </PageContainer>
  );
}
