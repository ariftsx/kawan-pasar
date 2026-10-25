'use client';

// Rencana Menu (docs 09 §5.2): cost per day, where it comes from, every menu, and a simulation.
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton } from '@kawan-pasar/ui';
import { useRouter } from 'next/navigation';

import { ForecastTrustCard } from '@/features/outlook/forecast-trust-card';
import { newMenuId } from '@/lib/guest-store/repository';

import { CostShareBar } from './components/cost-share-bar';
import { ExportButton } from './components/export-button';
import { MenuTable } from './components/menu-table';
import { PlanSummary } from './components/plan-summary';
import { SimulationSection } from './components/simulation-section';
import { useGuestPlan } from './guest-plan';
import { usePlan } from './use-plan';

export function StorageError() {
  return (
    <ErrorState
      title="Penyimpanan perangkat tidak bisa dibuka"
      description="Mode privat atau pengaturan browser mungkin memblokir penyimpanan lokal."
    />
  );
}

function RencanaHeader({
  menuCount,
  portionsPerDay,
}: {
  readonly menuCount: number;
  readonly portionsPerDay: number;
}) {
  const router = useRouter();
  const { saveMenu } = useGuestPlan();
  const addCustomMenu = async () => {
    const id = newMenuId();
    await saveMenu({
      id,
      name: 'Menu baru',
      template: null,
      portions_per_day: 30,
      sell_price_idr: null,
      recipe: [],
      updated_at: new Date().toISOString(),
    });
    router.push(`/rencana/${id}`);
  };
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Rencana Menu</h1>
        <p className="text-sm text-text-secondary">
          {menuCount} menu · {portionsPerDay} porsi/hari · horizon 7 hari · Pasar Kramatjati
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onPress={() => void addCustomMenu()}>
          Tambah menu sendiri
        </Button>
        <ExportButton />
      </div>
    </header>
  );
}

export function RencanaScreen() {
  const plan = usePlan();
  const { state, summary, costed, isDemo, hasOutlook, outlook } = plan;

  if (state.status === 'loading') return <Skeleton className="h-64" />;
  if (state.status === 'error') return <StorageError />;
  if (state.menus.length === 0) {
    return (
      <EmptyState
        title="Belum ada menu"
        description="Tambahkan menu untuk melihat modal per porsi."
        action={<ButtonLink href="/atur-warung">Atur warung</ButtonLink>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RencanaHeader menuCount={summary.menuCount} portionsPerDay={summary.portionsPerDay} />

      <PlanSummary
        summary={summary}
        hasOutlook={hasOutlook}
        isDemo={isDemo}
        isOutlookDemo={outlook.status === 'ready' && outlook.isDemo}
      />

      <Card aria-labelledby="share-title" className="flex flex-col gap-4">
        <h2 id="share-title" className="text-lg font-semibold">
          Asal modal per hari
        </h2>
        {summary.shares.length === 0 ? (
          <p className="text-sm text-text-secondary">Belum ada bahan yang punya harga.</p>
        ) : (
          <CostShareBar shares={summary.shares} />
        )}
        <p className="text-xs text-text-muted">★ = bahan yang punya perkiraan harga.</p>
      </Card>

      <Card aria-labelledby="menu-title" className="flex flex-col gap-4">
        <h2 id="menu-title" className="text-lg font-semibold">
          Menu Anda
        </h2>
        <MenuTable menus={costed} hasOutlook={hasOutlook} />
      </Card>

      <SimulationSection menus={costed} />
      <ForecastTrustCard outlook={outlook} />
    </div>
  );
}
