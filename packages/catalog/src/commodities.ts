export type CommodityCode =
  | 'cabai-merah-keriting'
  | 'bawang-merah'
  | 'beras-medium-1'
  | 'cabai-rawit-hijau'
  | 'cabai-rawit-merah';

export type ModelCoverage = 'covered' | 'pending';

export interface Commodity {
  readonly code: CommodityCode;
  readonly name: string;
  /** PIHPS `comcat_id`; null when the commodity has no source data yet. */
  readonly sourceRef: string | null;
  readonly unit: 'kg';
  readonly modelCoverage: ModelCoverage;
  readonly sortOrder: number;
}

export const COMMODITIES = [
  {
    code: 'cabai-merah-keriting',
    name: 'Cabai merah keriting',
    sourceRef: 'com_14',
    unit: 'kg',
    modelCoverage: 'covered',
    sortOrder: 1,
  },
  {
    code: 'bawang-merah',
    name: 'Bawang merah',
    sourceRef: 'com_11',
    unit: 'kg',
    modelCoverage: 'covered',
    sortOrder: 2,
  },
  {
    code: 'beras-medium-1',
    name: 'Beras medium I',
    sourceRef: 'com_3',
    unit: 'kg',
    modelCoverage: 'covered',
    sortOrder: 3,
  },
  {
    code: 'cabai-rawit-hijau',
    name: 'Cabai rawit hijau',
    sourceRef: 'com_15',
    unit: 'kg',
    modelCoverage: 'pending',
    sortOrder: 4,
  },
  {
    code: 'cabai-rawit-merah',
    name: 'Cabai rawit merah',
    sourceRef: 'com_16',
    unit: 'kg',
    modelCoverage: 'pending',
    sortOrder: 5,
  },
] as const satisfies readonly Commodity[];

export function findCommodityBySourceRef(ref: string): Commodity | undefined {
  return COMMODITIES.find((c) => c.sourceRef === ref);
}
