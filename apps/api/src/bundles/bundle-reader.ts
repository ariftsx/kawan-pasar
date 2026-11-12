import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BundleForecastRowSchema, BundleMetadataSchema } from '@kawan-pasar/contracts';
import type { BundleForecastRow, BundleMetadata } from '@kawan-pasar/contracts';

export const CSV_COLUMNS = [
  'market_code',
  'commodity_code',
  'base_date',
  'horizon_days',
  'q10_change',
  'q50_change',
  'q90_change',
  'q10_price_idr',
  'q50_price_idr',
  'q90_price_idr',
  'eval_status',
] as const;

const NUMERIC = new Set<string>([
  'horizon_days',
  'q10_change',
  'q50_change',
  'q90_change',
  'q10_price_idr',
  'q50_price_idr',
  'q90_price_idr',
]);
const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;
const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;

export interface ReadBundle {
  readonly metadata: BundleMetadata | null;
  readonly rows: readonly BundleForecastRow[];
  /** Human-readable problems: field names and line numbers only, never cell values. */
  readonly schemaErrors: readonly string[];
  readonly checksumOk: boolean;
  /** SHA-256 (hex) of forecasts.csv as read. */
  readonly forecastsSha256: string;
}

const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

async function readLimited(file: string): Promise<Buffer | null> {
  try {
    const data = await readFile(file);
    return data.length > MAX_BUNDLE_BYTES ? null : data;
  } catch {
    return null;
  }
}

function cell(column: string, raw: string): string | number | null {
  const text = raw.trim();
  if (text === '') return null;
  if (NUMERIC.has(column) && NUMBER_TEXT.test(text)) return Number(text);
  return text;
}

function parseCsv(text: string): { rows: BundleForecastRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0]?.split(',').map((h) => h.trim()) ?? [];
  if (header.join(',') !== CSV_COLUMNS.join(',')) {
    return { rows: [], errors: ['forecasts.csv: header does not match the contract'] };
  }
  const rows: BundleForecastRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = line.split(',');
    const lineNo = index + 2;
    if (cells.length !== CSV_COLUMNS.length) {
      errors.push(`forecasts.csv line ${String(lineNo)}: wrong number of columns`);
      return;
    }
    const record = Object.fromEntries(CSV_COLUMNS.map((c, i) => [c, cell(c, cells[i] ?? '')]));
    const parsed = BundleForecastRowSchema.safeParse(record);
    if (parsed.success) rows.push(parsed.data);
    else {
      const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
      errors.push(`forecasts.csv line ${String(lineNo)}: invalid ${fields}`);
    }
  });
  return { rows, errors };
}

/** Reads a bundle directory. Never throws for bad content: problems are reported in the result. */
export async function readBundle(dir: string): Promise<ReadBundle> {
  const [metaRaw, csvRaw, sumsRaw] = await Promise.all([
    readLimited(path.join(dir, 'metadata.json')),
    readLimited(path.join(dir, 'forecasts.csv')),
    readLimited(path.join(dir, 'SHA256SUMS')),
  ]);
  const schemaErrors: string[] = [];

  let metadata: BundleMetadata | null = null;
  if (metaRaw === null) schemaErrors.push('metadata.json missing or too large');
  else {
    try {
      const parsed = BundleMetadataSchema.safeParse(JSON.parse(metaRaw.toString('utf8')));
      if (parsed.success) metadata = parsed.data;
      else {
        const fields = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
        schemaErrors.push(`metadata.json: invalid ${fields}`);
      }
    } catch {
      schemaErrors.push('metadata.json: not valid JSON');
    }
  }

  let rows: BundleForecastRow[] = [];
  if (csvRaw === null) schemaErrors.push('forecasts.csv missing or too large');
  else {
    const parsed = parseCsv(csvRaw.toString('utf8'));
    rows = parsed.rows;
    schemaErrors.push(...parsed.errors);
  }

  const expected = new Map(
    (sumsRaw?.toString('utf8') ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim().split(/\s+/))
      .filter((p): p is [string, string] => p.length === 2)
      .map(([hash, file]) => [file.replace(/^\*/, ''), hash.toLowerCase()]),
  );
  const forecastsSha256 = csvRaw === null ? '' : sha256(csvRaw);
  const checksumOk =
    csvRaw !== null &&
    metaRaw !== null &&
    expected.get('forecasts.csv') === forecastsSha256 &&
    expected.get('metadata.json') === sha256(metaRaw);

  return { metadata, rows, schemaErrors, checksumOk, forecastsSha256 };
}
