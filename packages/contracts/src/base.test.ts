import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BUNDLE_MANIFEST, ENVELOPE_PARTS, ULID } from './base-examples.fixture.js';
import { BundleManifest } from './bundle.js';
import { HorizonDay } from './enums.js';
import { ErrorEnvelope, successEnvelope } from './envelope.js';
import { ERROR_STATUS } from './errors.js';
import { Slug, Timestamp, prefixedId } from './primitives.js';

function messages(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('envelope (docs 08 §3)', () => {
  const envelope = successEnvelope(z.strictObject({ ok: z.boolean() }));

  it('wraps data with meta, provenance, and availability', () => {
    const parsed = envelope.parse({ data: { ok: true }, ...ENVELOPE_PARTS, error: null });
    expect(parsed.provenance?.artifact_status).toBe('candidate');
  });

  it('defaults limitations and rejects unknown top-level fields', () => {
    const minimal = { data: { ok: true }, meta: ENVELOPE_PARTS.meta, error: null };
    expect(envelope.parse(minimal).limitations).toEqual([]);
    expect(envelope.safeParse({ ...minimal, debug: true }).success).toBe(false);
  });

  it('error envelope carries a known code and never a stack', () => {
    const error = {
      code: 'RATE_LIMITED',
      message: 'Terlalu banyak permintaan.',
      request_id: 'req_1',
    };

    expect(ErrorEnvelope.safeParse({ data: null, error }).success).toBe(true);
    expect(
      ErrorEnvelope.safeParse({ data: null, error: { ...error, stack: 'at x' } }).success,
    ).toBe(false);
    expect(ERROR_STATUS.RATE_LIMITED).toBe(429);
  });
});

describe('bundle manifest (docs 08 §12.2)', () => {
  const withManifest = (patch: Record<string, unknown>) => ({ ...BUNDLE_MANIFEST, ...patch });

  it('parses the documented example', () => {
    expect(BundleManifest.safeParse(BUNDLE_MANIFEST).success).toBe(true);
  });

  it.each([
    ['../escape.json'],
    ['/abs/path.json'],
    ['forecasts/../../etc/passwd'],
    ['a\\b.json'],
    ['a//b.json'],
  ])('rejects unsafe path %s', (path) => {
    const files = [{ ...BUNDLE_MANIFEST.files[0], path }];
    expect(messages(BundleManifest.safeParse(withManifest({ files })))).toContain(
      'Path file bundle tidak aman.',
    );
  });

  it('rejects a cutoff after generation, a mismatched id, and duplicate files', () => {
    const late = withManifest({ data_cutoff: '2026-10-19T00:00:00+07:00' });
    const mismatched = withManifest({ bundle_id: 'other-1.0.0__2026-10-18' });
    const duplicated = withManifest({
      files: [BUNDLE_MANIFEST.files[0], BUNDLE_MANIFEST.files[0]],
    });

    expect(messages(BundleManifest.safeParse(late))).toContain('data_cutoff harus ≤ generated_at.');
    expect(messages(BundleManifest.safeParse(mismatched))).toContain(
      'bundle_id harus diawali model_version.',
    );
    expect(messages(BundleManifest.safeParse(duplicated))).toContain(
      'Path file dalam manifest tidak boleh ganda.',
    );
  });
});

describe('primitives', () => {
  it('accepts only published horizons', () => {
    expect(HorizonDay.safeParse(7).success).toBe(true);
    expect(HorizonDay.safeParse(5).success).toBe(false);
  });

  it('validates slugs', () => {
    expect(Slug.safeParse('beras-medium-1').success).toBe(true);
    expect(Slug.safeParse('beras--medium').success).toBe(false);
    expect(Slug.safeParse('beras-').success).toBe(false);
    expect(Slug.safeParse('Beras').success).toBe(false);
  });

  it('validates prefixed ULIDs', () => {
    expect(prefixedId('mnu').safeParse(`mnu_${ULID}`).success).toBe(true);
    expect(prefixedId('mnu').safeParse(`usr_${ULID}`).success).toBe(false);
    expect(prefixedId('mnu').safeParse('mnu_01J…').success).toBe(false);
  });

  it('requires an explicit offset on timestamps', () => {
    expect(Timestamp.safeParse('2026-10-14T07:00:00+07:00').success).toBe(true);
    expect(Timestamp.safeParse('2026-10-14T07:00:00').success).toBe(false);
  });
});
