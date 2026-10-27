'use client';

// Rincian Menu (docs 09 §5.3): ingredients per portion, margin, and the outlook teaser. The menu
// can be edited here: name, portions, sell price, and the recipe itself (ONB-02).
import { ButtonLink, Card, EmptyState, NumberStepper, Skeleton, TextField } from '@kawan-pasar/ui';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/icons';
import { ForecastTrustCard } from '@/features/outlook/forecast-trust-card';

import { DeleteMenu } from './components/delete-menu';
import { IngredientTable } from './components/ingredient-table';
import { MarginCard } from './components/margin-card';
import { MenuMetrics } from './components/menu-metrics';
import { RecipeEditor } from './components/recipe-editor';
import { SimulationCard } from './components/simulation-card';
import { usePlan } from './use-plan';

import type { GuestMenu } from '@/lib/guest-store/schema';

function MenuNotFound() {
  return (
    <EmptyState
      title="Menu tidak ditemukan"
      description="Menu ini tidak ada di perangkat ini."
      action={<ButtonLink href="/rencana">Kembali ke Rencana Menu</ButtonLink>}
    />
  );
}

function MenuHeader({
  menu,
  onSave,
}: {
  readonly menu: GuestMenu;
  readonly onSave: (change: Partial<GuestMenu>) => void;
}) {
  return (
    <header className="flex flex-col gap-3">
      <ButtonLink href="/rencana" variant="ghost" size="sm" className="self-start">
        <Icon name="chevron-left" className="size-5" />
        Rencana Menu
      </ButtonLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <TextField
          label="Nama menu"
          defaultValue={menu.name}
          maxLength={60}
          onChange={(name) => {
            if (name.trim() !== '') onSave({ name: name.trim() });
          }}
          className="min-w-64"
        />
        <NumberStepper
          label="Porsi per hari"
          unit="porsi/hari"
          minValue={0}
          maxValue={10_000}
          step={5}
          value={menu.portions_per_day}
          onChange={(portions) => {
            if (Number.isInteger(portions) && portions >= 0) onSave({ portions_per_day: portions });
          }}
        />
      </div>
    </header>
  );
}

export function RincianScreen({ menuId }: { readonly menuId: string }) {
  const router = useRouter();
  const plan = usePlan();
  const { state, costed, isDemo, hasOutlook, outlook, mode } = plan;

  if (state.status === 'loading') return <Skeleton className="h-64" />;
  const entry = costed.find(({ menu }) => menu.id === menuId);
  if (entry === undefined) return <MenuNotFound />;

  const { menu, cost } = entry;
  const save = (change: Partial<GuestMenu>) => {
    void plan.saveMenu({ ...menu, ...change, updated_at: new Date().toISOString() });
  };
  const canSimulate = cost !== null && cost.coverage.itemsPriced > 0;

  return (
    <div className="flex flex-col gap-6">
      <MenuHeader menu={menu} onSave={save} />
      <MenuMetrics
        cost={cost}
        hasOutlook={hasOutlook}
        isDemo={isDemo}
        isOutlookDemo={outlook.status === 'ready' && outlook.isDemo}
      />
      <Card aria-labelledby="ingredients-title" className="flex flex-col gap-3">
        <h2 id="ingredients-title" className="text-xl font-bold">
          Bahan per porsi
        </h2>
        <IngredientTable recipe={menu.recipe} cost={cost} mode={mode} outlooks={outlook.map} />
      </Card>
      <MarginCard
        cost={cost}
        sellPriceIdr={menu.sell_price_idr}
        portionsPerDay={menu.portions_per_day}
        hasOutlook={hasOutlook}
        onSellPrice={(price) => {
          save({ sell_price_idr: price });
        }}
      />
      {canSimulate ? <SimulationCard cost={cost} portionsPerDay={menu.portions_per_day} /> : null}
      <RecipeEditor
        recipe={menu.recipe}
        onSave={(recipe) => {
          save({ recipe });
        }}
      />
      <ForecastTrustCard outlook={outlook} />
      <div className="flex justify-end">
        <DeleteMenu
          onDelete={() => {
            void plan.deleteMenu(menu.id).then(() => {
              router.push('/rencana');
            });
          }}
        />
      </div>
    </div>
  );
}
