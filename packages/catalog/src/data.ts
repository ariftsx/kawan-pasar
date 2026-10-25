// Catalog seed, version CATALOG_VERSION (F1-Q2, approved 26 Okt 2026).
// Every price here is DATA DEMO: a sample for the demo mode, never a market observation.
// Quantities are per portion and still need the PO's check against the interview notes.
import type { Ingredient, MenuTemplate, WarungType } from './schema.js';

export const CATALOG_VERSION = 'catalog-0.1.0';

const kg = (
  slug: string,
  name: string,
  demoPrice: number,
  commodity: string | null = null,
): Ingredient => ({
  slug,
  name,
  commodity,
  support_status: commodity === null ? 'coming_soon' : 'supported',
  price_unit: 'kg',
  demo_price_idr: demoPrice,
});

export const INGREDIENTS: readonly Ingredient[] = [
  // The 3 model commodities (docs 08 §4.1). Demo prices match the apps/web DATA DEMO card.
  kg('cabai-merah-keriting', 'Cabai merah keriting', 52_400, 'cabai-merah-keriting'),
  kg('bawang-merah', 'Bawang merah', 38_933, 'bawang-merah'),
  kg('beras-medium-1', 'Beras medium', 13_650, 'beras-medium-1'),
  kg('daging-ayam-ras', 'Daging ayam ras', 36_667),
  {
    slug: 'telur-ayam-ras',
    name: 'Telur ayam ras',
    commodity: null,
    support_status: 'coming_soon',
    price_unit: 'kg',
    grams_per_piece: 60,
    demo_price_idr: 28_000,
  },
  {
    slug: 'minyak-goreng',
    name: 'Minyak goreng',
    commodity: null,
    support_status: 'coming_soon',
    price_unit: 'l',
    demo_price_idr: 40_000,
  },
  {
    slug: 'santan',
    name: 'Santan',
    commodity: null,
    support_status: 'coming_soon',
    price_unit: 'l',
    demo_price_idr: 40_000,
  },
  kg('daging-sapi', 'Daging sapi', 135_000),
  kg('ikan-lele', 'Ikan lele', 30_000),
  kg('tahu', 'Tahu', 12_000),
  kg('tempe', 'Tempe', 14_000),
  kg('nangka-muda', 'Nangka muda', 10_000),
  kg('bawang-putih', 'Bawang putih', 36_000),
  kg('tomat', 'Tomat', 15_000),
  kg('sayur-asem', 'Sayur asem (paket)', 12_000),
  kg('bumbu-lain', 'Bumbu lain', 36_000),
];

export const WARUNG_TYPES: readonly WarungType[] = [
  { slug: 'warteg', name: 'Warteg', description: 'Nasi rames, sayur, dan lauk harian.' },
  { slug: 'padang', name: 'Masakan Padang', description: 'Lauk bersantan dan berbumbu kuat.' },
  {
    slug: 'geprek',
    name: 'Ayam Geprek / Penyet',
    description: 'Lauk goreng dengan sambal sebagai menu utama.',
  },
];

export const MENU_TEMPLATES: readonly MenuTemplate[] = [
  {
    slug: 'ayam-geprek-nasi',
    warung_type: 'geprek',
    name: 'Ayam Geprek + Nasi',
    portions_per_day: 100,
    sell_price_idr: 15_000,
    // The DATA DEMO card recipe (docs 05 §4): Rp 10.850 per portion.
    recipe: [
      { ingredient: 'beras-medium-1', qty: 120, unit: 'g' },
      { ingredient: 'daging-ayam-ras', qty: 150, unit: 'g' },
      { ingredient: 'minyak-goreng', qty: 15, unit: 'ml' },
      { ingredient: 'cabai-merah-keriting', qty: 40, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 15, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 12, unit: 'g' },
    ],
  },
  {
    slug: 'pecel-lele',
    warung_type: 'geprek',
    name: 'Pecel Lele + Nasi',
    portions_per_day: 60,
    sell_price_idr: 17_000,
    recipe: [
      { ingredient: 'beras-medium-1', qty: 120, unit: 'g' },
      { ingredient: 'ikan-lele', qty: 150, unit: 'g' },
      { ingredient: 'minyak-goreng', qty: 20, unit: 'ml' },
      { ingredient: 'cabai-merah-keriting', qty: 30, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 10, unit: 'g' },
      { ingredient: 'tomat', qty: 20, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 10, unit: 'g' },
    ],
  },
  {
    slug: 'tahu-tempe-penyet',
    warung_type: 'geprek',
    name: 'Tahu Tempe Penyet + Nasi',
    portions_per_day: 50,
    sell_price_idr: 12_000,
    recipe: [
      { ingredient: 'beras-medium-1', qty: 120, unit: 'g' },
      { ingredient: 'tahu', qty: 60, unit: 'g' },
      { ingredient: 'tempe', qty: 60, unit: 'g' },
      { ingredient: 'minyak-goreng', qty: 15, unit: 'ml' },
      { ingredient: 'cabai-merah-keriting', qty: 30, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 10, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 8, unit: 'g' },
    ],
  },
  {
    slug: 'nasi-telur-balado',
    warung_type: 'warteg',
    name: 'Nasi + Telur Balado',
    portions_per_day: 80,
    sell_price_idr: 12_000,
    recipe: [
      { ingredient: 'beras-medium-1', qty: 150, unit: 'g' },
      { ingredient: 'telur-ayam-ras', qty: 1, unit: 'butir' },
      { ingredient: 'cabai-merah-keriting', qty: 25, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 10, unit: 'g' },
      { ingredient: 'bawang-putih', qty: 5, unit: 'g' },
      { ingredient: 'tomat', qty: 15, unit: 'g' },
      { ingredient: 'minyak-goreng', qty: 10, unit: 'ml' },
    ],
  },
  {
    slug: 'sayur-asem',
    warung_type: 'warteg',
    name: 'Sayur Asem',
    portions_per_day: 60,
    sell_price_idr: 5_000,
    recipe: [
      { ingredient: 'sayur-asem', qty: 100, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 5, unit: 'g' },
      { ingredient: 'cabai-merah-keriting', qty: 5, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 5, unit: 'g' },
    ],
  },
  {
    slug: 'tempe-orek',
    warung_type: 'warteg',
    name: 'Tempe Orek',
    portions_per_day: 60,
    sell_price_idr: 5_000,
    recipe: [
      { ingredient: 'tempe', qty: 80, unit: 'g' },
      { ingredient: 'cabai-merah-keriting', qty: 10, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 8, unit: 'g' },
      { ingredient: 'bawang-putih', qty: 4, unit: 'g' },
      { ingredient: 'minyak-goreng', qty: 8, unit: 'ml' },
      { ingredient: 'bumbu-lain', qty: 6, unit: 'g' },
    ],
  },
  {
    slug: 'rendang-nasi',
    warung_type: 'padang',
    name: 'Nasi + Rendang',
    portions_per_day: 40,
    sell_price_idr: 25_000,
    recipe: [
      { ingredient: 'beras-medium-1', qty: 150, unit: 'g' },
      { ingredient: 'daging-sapi', qty: 80, unit: 'g' },
      { ingredient: 'santan', qty: 60, unit: 'ml' },
      { ingredient: 'cabai-merah-keriting', qty: 20, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 15, unit: 'g' },
      { ingredient: 'bawang-putih', qty: 5, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 10, unit: 'g' },
    ],
  },
  {
    slug: 'ayam-pop-nasi',
    warung_type: 'padang',
    name: 'Nasi + Ayam Pop',
    portions_per_day: 40,
    sell_price_idr: 20_000,
    recipe: [
      { ingredient: 'beras-medium-1', qty: 150, unit: 'g' },
      { ingredient: 'daging-ayam-ras', qty: 150, unit: 'g' },
      { ingredient: 'minyak-goreng', qty: 10, unit: 'ml' },
      { ingredient: 'cabai-merah-keriting', qty: 15, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 10, unit: 'g' },
      { ingredient: 'bawang-putih', qty: 5, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 8, unit: 'g' },
    ],
  },
  {
    slug: 'gulai-nangka',
    warung_type: 'padang',
    name: 'Gulai Nangka',
    portions_per_day: 40,
    sell_price_idr: 6_000,
    recipe: [
      { ingredient: 'nangka-muda', qty: 100, unit: 'g' },
      { ingredient: 'santan', qty: 50, unit: 'ml' },
      { ingredient: 'cabai-merah-keriting', qty: 10, unit: 'g' },
      { ingredient: 'bawang-merah', qty: 8, unit: 'g' },
      { ingredient: 'bumbu-lain', qty: 8, unit: 'g' },
    ],
  },
];
