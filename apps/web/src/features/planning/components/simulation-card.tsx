'use client';

import {
  simulatePriceIncrease,
  type MenuCost,
  type PriceIncreaseSimulation,
} from '@kawan-pasar/domain';
import { Card, Slider } from '@kawan-pasar/ui';
import { useState } from 'react';

import { formatRupiah } from '@/lib/format';
import { ingredientName } from '@/lib/planning/view';

function SimulationResult({ result }: { readonly result: PriceIncreaseSimulation }) {
  const figures = [
    ['Modal per porsi', result.perPortionIdr, result.deltaPerPortionIdr, 'per porsi'],
    ['Modal per hari', result.perDayIdr, result.deltaPerDayIdr, 'per hari'],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-3">
      {figures.map(([label, value, delta, unit]) => (
        <div key={label}>
          <dt className="text-sm text-text-secondary">{label}</dt>
          <dd className="tabular-nums text-xl font-semibold">{formatRupiah(value)}</dd>
          <dd className="text-sm text-text-secondary">
            +{formatRupiah(delta)} {unit}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** SimulationCard (docs 10 §7.3): plain arithmetic in packages/domain, never a model forecast. */
export function SimulationCard({
  cost,
  portionsPerDay,
}: {
  readonly cost: MenuCost;
  readonly portionsPerDay: number;
}) {
  const priced = cost.items.filter((item) => item.costTodayIdr !== null);
  const [ingredientId, setIngredientId] = useState(priced[0]?.ingredientId ?? '');
  const [percent, setPercent] = useState(30);
  if (priced.length === 0) return null;
  const result = simulatePriceIncrease(cost, ingredientId, percent / 100, portionsPerDay);

  return (
    <Card aria-labelledby="simulation-title" className="flex flex-col gap-4">
      <div>
        <h2 id="simulation-title" className="text-xl font-bold">
          Simulasi kenaikan harga
        </h2>
        <p className="text-sm text-text-secondary">Hitungan biasa, bukan perkiraan model.</p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Bahan
        <select
          value={ingredientId}
          onChange={(event) => {
            setIngredientId(event.target.value);
          }}
          className="min-h-11 rounded-md border border-border-control bg-bg-surface px-3 text-base text-text-primary"
        >
          {priced.map((item) => (
            <option key={item.ingredientId} value={item.ingredientId}>
              {ingredientName(item.ingredientId)}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label="Kalau harganya naik"
        minValue={0}
        maxValue={100}
        step={5}
        value={percent}
        onChange={setPercent}
        formatOptions={{ style: 'unit', unit: 'percent' }}
      />
      {result.ok ? (
        <SimulationResult result={result.value} />
      ) : (
        <p className="text-sm text-text-secondary">{result.error.message}</p>
      )}
    </Card>
  );
}
