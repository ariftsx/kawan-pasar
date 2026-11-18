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
// Fase 2A — accounts. Analyst and admin roles arrive in Fase 3.
export const userRole = pgEnum('user_role', ['user']);
export const authTokenPurpose = pgEnum('auth_token_purpose', ['verify_email', 'reset_password']);
export const authEventType = pgEnum('auth_event_type', [
  'register',
  'login_ok',
  'login_fail',
  'locked',
  'logout',
  'verify',
  'reset_request',
  'reset_done',
  'password_change',
  'session_revoke',
  'account_delete',
]);
