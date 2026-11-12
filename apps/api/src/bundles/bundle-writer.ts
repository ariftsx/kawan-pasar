import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BundleForecastRow, BundleMetadata } from '@kawan-pasar/contracts';
import { CSV_COLUMNS } from './bundle-reader.js';

export interface BundleContent {
  readonly metadata: BundleMetadata;
  readonly rows: readonly BundleForecastRow[];
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export function toCsv(rows: readonly BundleForecastRow[]): string {
  const lines = rows.map((r) =>
    CSV_COLUMNS.map((c) => {
      const value = r[c];
      return value === null ? '' : String(value);
    }).join(','),
  );
  return `${[CSV_COLUMNS.join(','), ...lines].join('\n')}\n`;
}

/** Writes metadata.json, forecasts.csv and SHA256SUMS exactly as the bundle contract specifies. */
export async function writeBundleDir(dir: string, bundle: BundleContent): Promise<void> {
  await mkdir(dir, { recursive: true });
  const csv = toCsv(bundle.rows);
  const metadata = `${JSON.stringify(bundle.metadata, null, 2)}\n`;
  await writeFile(path.join(dir, 'forecasts.csv'), csv);
  await writeFile(path.join(dir, 'metadata.json'), metadata);
  await writeFile(
    path.join(dir, 'SHA256SUMS'),
    `${sha256(csv)}  forecasts.csv\n${sha256(metadata)}  metadata.json\n`,
  );
}
