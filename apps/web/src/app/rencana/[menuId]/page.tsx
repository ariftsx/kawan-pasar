import { RincianScreen } from '@/features/planning/rincian-screen';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Rincian Menu' };

export default async function RincianPage({
  params,
}: {
  readonly params: Promise<{ menuId: string }>;
}) {
  const { menuId } = await params;
  return <RincianScreen menuId={menuId} />;
}
