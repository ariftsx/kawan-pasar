'use client';

import { getIngredient, listIngredients, type RecipeItem } from '@kawan-pasar/catalog';
import { Button, Card, NumberStepper } from '@kawan-pasar/ui';
import { useState } from 'react';

const MAX_ITEMS = 20;

/** Default quantity unit for a new ingredient: ml for liquids, butir for eggs, grams otherwise. */
function defaultItem(slug: string): RecipeItem | null {
  const ingredient = getIngredient(slug);
  if (ingredient === undefined) return null;
  if (ingredient.price_unit === 'l') return { ingredient: slug, qty: 10, unit: 'ml' };
  if (ingredient.grams_per_piece !== undefined) return { ingredient: slug, qty: 1, unit: 'butir' };
  return { ingredient: slug, qty: 10, unit: 'g' };
}

function RecipeRow({
  item,
  onQty,
  onRemove,
}: {
  readonly item: RecipeItem;
  readonly onQty: (qty: number) => void;
  readonly onRemove: () => void;
}) {
  const name = getIngredient(item.ingredient)?.name ?? item.ingredient;
  return (
    <li className="flex flex-wrap items-end justify-between gap-2">
      <NumberStepper
        label={name}
        unit={item.unit}
        minValue={1}
        maxValue={5000}
        // Step 1 so recipe quantities like 12 g or 15 ml are never snapped to another value.
        step={1}
        value={item.qty}
        onChange={(qty) => {
          if (Number.isFinite(qty) && qty > 0) onQty(qty);
        }}
      />
      <Button variant="ghost" size="sm" onPress={onRemove}>
        Hapus {name}
      </Button>
    </li>
  );
}

function AddIngredient({
  used,
  onAdd,
}: {
  readonly used: ReadonlySet<string>;
  readonly onAdd: (item: RecipeItem) => void;
}) {
  const available = listIngredients().filter((item) => !used.has(item.slug));
  const [adding, setAdding] = useState('');
  const chosen = available.some((item) => item.slug === adding)
    ? adding
    : (available[0]?.slug ?? '');
  if (available.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
        Tambah bahan
        <select
          value={chosen}
          onChange={(event) => {
            setAdding(event.target.value);
          }}
          className="min-h-11 rounded-md border border-border-control bg-bg-surface px-3 text-base text-text-primary"
        >
          {available.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name} · {item.support_status === 'supported' ? 'harga harian' : 'segera'}
            </option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        onPress={() => {
          const item = defaultItem(chosen);
          if (item !== null) onAdd(item);
        }}
      >
        Tambah
      </Button>
    </div>
  );
}

/** Edits the recipe per portion (ONB-02); supported ingredients are offered first. */
export function RecipeEditor({
  recipe,
  onSave,
}: {
  readonly recipe: readonly RecipeItem[];
  readonly onSave: (recipe: RecipeItem[]) => void;
}) {
  return (
    <Card aria-labelledby="editor-title" className="flex flex-col gap-4">
      <h2 id="editor-title" className="text-lg font-semibold">
        Ubah resep per porsi
      </h2>
      <ul className="flex flex-col gap-3">
        {recipe.map((item, index) => (
          <RecipeRow
            key={item.ingredient}
            item={item}
            onQty={(qty) => {
              onSave(recipe.map((row, i) => (i === index ? { ...row, qty } : row)));
            }}
            onRemove={() => {
              onSave(recipe.filter((_, i) => i !== index));
            }}
          />
        ))}
      </ul>
      {recipe.length < MAX_ITEMS ? (
        <AddIngredient
          used={new Set(recipe.map((item) => item.ingredient))}
          onAdd={(item) => {
            onSave([...recipe, item]);
          }}
        />
      ) : null}
    </Card>
  );
}
