import { pgEnum } from 'drizzle-orm/pg-core';

export const marketStatus = pgEnum('market_status', ['available', 'coming_soon']);
export const modelCoverage = pgEnum('model_coverage', ['covered', 'pending']);
export const artifactStatus = pgEnum('artifact_status', [
  'pending',
  'active',
  'retired',
  'rejected',
]);
export const evalStatus = pgEnum('eval_status', ['available', 'partial', 'not_tested']);
export const articleCategory = pgEnum('article_category', [
  'dasar',
  'prediksi',
  'arif-net',
  'keterbatasan',
]);
export const ingestStatus = pgEnum('ingest_status', ['running', 'succeeded', 'partial', 'failed']);
export const priceSource = pgEnum('price_source', ['seed_csv', 'pihps']);
