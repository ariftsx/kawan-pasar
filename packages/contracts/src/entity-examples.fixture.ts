// Entity examples from docs 08 §5, with placeholder ids (`…`) replaced by valid ULIDs.
// If the docs change, these must change with them; the tests keep both in sync.
import { ULID } from './base-examples.fixture.js';

export const PRICE_OBSERVATION = {
  commodity: 'cabai-merah-keriting',
  market: 'PIKJ',
  observed_at: '2026-10-14',
  available_at: '2026-10-14T07:00:00+07:00',
  price_idr: 52_400,
  unit: 'kg',
  source: 'pihps',
  status: 'valid',
};

const pricedItem = (
  ingredient: string,
  qty: number,
  unitPrice: number,
  cost: number,
  change: number,
  outlookCost: number,
  share: number,
) => ({
  ingredient,
  qty,
  unit: 'g',
  price: { status: 'available', unit_price_idr: unitPrice, observed_at: '2026-10-14' },
  cost_today_idr: cost,
  outlook: { status: 'available', predicted_change: change, cost_idr: outlookCost },
  share_ratio: share,
});

const comingSoonItem = (ingredient: string, qty: number, unit: string) => ({
  ingredient,
  qty,
  unit,
  price: { status: 'coming_soon' },
  cost_today_idr: null,
  outlook: { status: 'not_modeled', predicted_change: null, cost_idr: null },
  share_ratio: null,
});

/** docs 08 §5.2: live mode, 3 supported commodities. */
export const MENU_WITH_COST = {
  menu: {
    id: `mnu_${ULID}`,
    name: 'Ayam Geprek + Nasi',
    portions_per_day: 60,
    sell_price_idr: 15_000,
  },
  cost: {
    horizon_days: 7,
    completeness: 'partial',
    coverage: {
      items_total: 5,
      items_priced: 3,
      missing_ingredients: ['daging-ayam-ras', 'minyak-goreng'],
    },
    per_portion_today_idr: 3826,
    per_portion_outlook_idr: 3892,
    delta_ratio: 0.0173,
    per_day_today_idr: 229_560,
    per_day_outlook_idr: 233_520,
    items: [
      pricedItem('cabai-merah-keriting', 40, 52_400, 2096, 0.028, 2155, 0.548),
      pricedItem('bawang-merah', 10, 38_000, 380, 0.01, 384, 0.099),
      pricedItem('beras-medium-1', 100, 13_500, 1350, 0.002, 1353, 0.353),
      comingSoonItem('daging-ayam-ras', 150, 'g'),
      comingSoonItem('minyak-goreng', 15, 'ml'),
    ],
    margin_today_idr: null,
    margin_outlook_idr: null,
  },
};

/** docs 08 §5.3. */
export const FORECAST = {
  run: {
    id: `fr_${ULID}`,
    commodity: 'cabai-merah-keriting',
    market: 'PIKJ',
    origin: '2026-10-14',
    model_version: 'arif-net-0.3.0',
    dataset_version: 'food-price-0.4.0',
    preprocessing_version: 'prep-0.4.0',
    data_cutoff: '2026-10-14T12:00:00+07:00',
    status: 'published',
  },
  reference_price_idr: 52_400,
  points: [
    {
      horizon_day: 7,
      target_date: '2026-10-21',
      predicted_change: 0.028,
      predicted_price_idr: 53_867,
    },
  ],
};

/** docs 08 §5.4. */
export const MOVEMENT_THRESHOLD = {
  commodity: 'cabai-merah-keriting',
  horizon_day: 7,
  q95_abs_change: 0.089,
  method: 'empirical_quantile_linear',
  n_obs: 1712,
  window_end: '2026-10-19',
  status: 'available',
  version: 'thr-stat-20261020',
  source: 'product_price_history',
};

/** docs 08 §5.5. */
export const ALERT_EVENT = {
  id: `ale_${ULID}`,
  type: 'movement_q95',
  ingredient: 'cabai-merah-keriting',
  fired_for_date: '2026-10-14',
  payload: { change_7d: 0.032, q95: 0.089, outlook_7d: 0.028 },
  channels: ['in_app', 'web_push'],
  read_at: null,
};
