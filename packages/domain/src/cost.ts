/**
 * Menu cost per portion and per day (docs 05 §4, docs 08 §5.2).
 *
 * Only ingredients with a price count toward cost. Ingredients whose price is `missing` or
 * `coming_soon` are reported as `null` (never 0) and make the result `partial`; margin is then
 * withheld because a partial cost would make it look better than it is.
 */
import { isNonNegativeSafeInteger, roundRupiah, sumRupiah } from './money.js';
import { err, ok, type Result } from './result.js';
import { toPriceUnit, type PriceUnit, type QuantityInput } from './units.js';

export type IngredientPrice =
  | {
      readonly status: 'available' | 'stale';
      readonly unitPriceIdr: number;
      readonly priceUnit: PriceUnit;
    }
  | { readonly status: 'missing' | 'coming_soon' };

/** A predicted change applies for every status that still shows a forecast (docs 08 §12.4–12.5). */
export type IngredientOutlook =
  | {
      readonly status: 'available' | 'candidate' | 'stale' | 'in_development';
      readonly predictedChange: number;
    }
  | { readonly status: 'not_modeled' | 'missing' };

export type RecipeLine = QuantityInput & {
  readonly ingredientId: string;
  readonly price: IngredientPrice;
  readonly outlook: IngredientOutlook;
};

export type MenuCostInput = {
  readonly lines: readonly RecipeLine[];
  readonly portionsPerDay: number;
  readonly sellPriceIdr?: number;
};

export type CostLine = {
  readonly ingredientId: string;
  readonly priceStatus: IngredientPrice['status'];
  readonly outlookStatus: IngredientOutlook['status'];
  readonly costTodayIdr: number | null;
  readonly costOutlookIdr: number | null;
  readonly shareRatio: number | null;
};

export type CostCompleteness = 'complete' | 'partial';

export type MenuCost = {
  readonly completeness: CostCompleteness;
  readonly coverage: {
    readonly itemsTotal: number;
    readonly itemsPriced: number;
    readonly missingIngredients: readonly string[];
  };
  readonly perPortionTodayIdr: number | null;
  readonly perPortionOutlookIdr: number | null;
  readonly deltaRatio: number | null;
  readonly perDayTodayIdr: number | null;
  readonly perDayOutlookIdr: number | null;
  readonly marginTodayIdr: number | null;
  readonly marginOutlookIdr: number | null;
  readonly items: readonly CostLine[];
};

type PricedAmounts = { readonly today: number; readonly outlook: number };
type LineEntry = { readonly line: RecipeLine; readonly amount: PricedAmounts | null };

export function calculateMenuCost(input: MenuCostInput): Result<MenuCost> {
  const invalid = validateMenu(input);
  if (invalid !== null) return invalid;

  const entries: LineEntry[] = [];
  for (const line of input.lines) {
    const priced = priceLine(line);
    if (!priced.ok) return priced;
    entries.push({ line, amount: priced.value });
  }
  return ok(summarise(input, entries));
}

function validateMenu({ portionsPerDay, sellPriceIdr }: MenuCostInput): Result<never> | null {
  if (!isNonNegativeSafeInteger(portionsPerDay)) {
    return err('INVALID_PORTIONS', 'Porsi per hari harus bilangan bulat ≥ 0.');
  }
  if (sellPriceIdr !== undefined && !isNonNegativeSafeInteger(sellPriceIdr)) {
    return err('INVALID_SELL_PRICE', 'Harga jual harus rupiah bulat ≥ 0.');
  }
  return null;
}

type KnownPrice = Extract<IngredientPrice, { readonly unitPriceIdr: number }>;

function hasPrice(price: IngredientPrice): price is KnownPrice {
  return price.status === 'available' || price.status === 'stale';
}

function priceLine(line: RecipeLine): Result<PricedAmounts | null> {
  const { price, outlook } = line;
  if (!hasPrice(price)) return ok(null);
  if (!isNonNegativeSafeInteger(price.unitPriceIdr)) {
    return err('INVALID_PRICE', `Harga ${line.ingredientId} harus rupiah bulat ≥ 0.`);
  }
  const amount = toPriceUnit(line, price.priceUnit);
  if (!amount.ok) return amount;

  const exactToday = amount.value * price.unitPriceIdr;
  const change = 'predictedChange' in outlook ? outlook.predictedChange : 0;
  if (!Number.isFinite(change) || change <= -1) {
    return err('INVALID_CHANGE', `Perkiraan perubahan ${line.ingredientId} tidak valid.`);
  }
  // predicted price = reference × (1 + change) (docs 08 §5.3), so cost scales the same way.
  return ok({ today: roundRupiah(exactToday), outlook: roundRupiah(exactToday * (1 + change)) });
}

function summarise(input: MenuCostInput, entries: readonly LineEntry[]): MenuCost {
  const priced = entries.flatMap((entry) => (entry.amount === null ? [] : [entry.amount]));
  const missingIngredients = entries
    .filter((entry) => entry.amount === null)
    .map((entry) => entry.line.ingredientId);
  const completeness: CostCompleteness = missingIngredients.length === 0 ? 'complete' : 'partial';
  const totals: PricedAmounts | null =
    priced.length === 0
      ? null
      : {
          today: sumRupiah(priced.map((amount) => amount.today)),
          outlook: sumRupiah(priced.map((amount) => amount.outlook)),
        };

  return {
    completeness,
    coverage: { itemsTotal: input.lines.length, itemsPriced: priced.length, missingIngredients },
    ...perPortionAndDay(totals, input.portionsPerDay),
    ...margins(input.sellPriceIdr, completeness, totals),
    items: entries.map((entry) => toCostLine(entry.line, entry.amount, totals)),
  };
}

function perPortionAndDay(
  totals: PricedAmounts | null,
  portionsPerDay: number,
): Pick<
  MenuCost,
  | 'perPortionTodayIdr'
  | 'perPortionOutlookIdr'
  | 'deltaRatio'
  | 'perDayTodayIdr'
  | 'perDayOutlookIdr'
> {
  if (totals === null) {
    return {
      perPortionTodayIdr: null,
      perPortionOutlookIdr: null,
      deltaRatio: null,
      perDayTodayIdr: null,
      perDayOutlookIdr: null,
    };
  }
  return {
    perPortionTodayIdr: totals.today,
    perPortionOutlookIdr: totals.outlook,
    deltaRatio: totals.today === 0 ? null : totals.outlook / totals.today - 1,
    perDayTodayIdr: totals.today * portionsPerDay,
    perDayOutlookIdr: totals.outlook * portionsPerDay,
  };
}

function margins(
  sellPriceIdr: number | undefined,
  completeness: CostCompleteness,
  totals: PricedAmounts | null,
): Pick<MenuCost, 'marginTodayIdr' | 'marginOutlookIdr'> {
  if (sellPriceIdr === undefined || completeness === 'partial' || totals === null) {
    return { marginTodayIdr: null, marginOutlookIdr: null };
  }
  return {
    marginTodayIdr: sellPriceIdr - totals.today,
    marginOutlookIdr: sellPriceIdr - totals.outlook,
  };
}

function toCostLine(
  line: RecipeLine,
  amount: PricedAmounts | null,
  totals: PricedAmounts | null,
): CostLine {
  const share =
    amount !== null && totals !== null && totals.today > 0 ? amount.today / totals.today : null;
  return {
    ingredientId: line.ingredientId,
    priceStatus: line.price.status,
    outlookStatus: line.outlook.status,
    costTodayIdr: amount?.today ?? null,
    costOutlookIdr: amount?.outlook ?? null,
    shareRatio: share,
  };
}
