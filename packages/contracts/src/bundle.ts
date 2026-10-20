// ARIF-Net artifact bundle manifest (docs 08 §12.2). Produced by the weekly research pipeline and
// verified by the worker before promotion; anything that does not parse is rejected.
import { z } from 'zod';

import { ArtifactStatus, HorizonDay } from './enums.js';
import { Sha256Hex, Slug, Timestamp } from './primitives.js';

export const BUNDLE_SCHEMA = 'kp-artifact-bundle-1.0.0';

/** `<model_version>__<YYYY-MM-DD>`; `demo__…` marks the development bundle (docs 08 §12.5). */
export const BundleId = z.string().regex(/^[a-z0-9][a-z0-9.-]*__\d{4}-\d{2}-\d{2}$/);

const PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Relative POSIX path inside the bundle: no absolute paths, no `..`, no backslashes. */
export const BundlePath = z
  .string()
  .max(200)
  .refine(
    (path) => path.split('/').every((segment) => PATH_SEGMENT.test(segment) && segment !== '..'),
    { message: 'Path file bundle tidak aman.' },
  );

export const BundleFile = z.strictObject({
  path: BundlePath,
  sha256: Sha256Hex,
  bytes: z.int().nonnegative(),
});

export const BundleManifest = z
  .strictObject({
    bundle_schema: z.literal(BUNDLE_SCHEMA),
    bundle_id: BundleId,
    model_version: z.string().min(1),
    dataset_version: z.string().min(1),
    preprocessing_version: z.string().min(1),
    data_cutoff: Timestamp,
    generated_at: Timestamp,
    artifact_status: ArtifactStatus,
    source_commit: z.string().regex(/^[0-9a-f]{7,40}$/),
    commodities: z.array(Slug).min(1),
    horizons: z.array(HorizonDay).min(1),
    files: z.array(BundleFile).min(1),
    limitations: z.array(z.string().min(1)).min(1),
  })
  .superRefine((manifest, ctx) => {
    if (Date.parse(manifest.data_cutoff) > Date.parse(manifest.generated_at)) {
      ctx.addIssue({
        code: 'custom',
        message: 'data_cutoff harus ≤ generated_at.',
        input: manifest,
      });
    }
    if (!manifest.bundle_id.startsWith(`${manifest.model_version}__`)) {
      ctx.addIssue({
        code: 'custom',
        message: 'bundle_id harus diawali model_version.',
        input: manifest,
      });
    }
    if (new Set(manifest.files.map((file) => file.path)).size !== manifest.files.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Path file dalam manifest tidak boleh ganda.',
        input: manifest,
      });
    }
  });

export type BundleManifest = z.infer<typeof BundleManifest>;
