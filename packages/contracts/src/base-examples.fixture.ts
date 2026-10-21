// Examples from docs 08 (§3 envelope, §12.2 bundle manifest) with placeholder ids replaced by
// valid ULIDs. If the docs change, these must change with them.

export const ULID = '01JAB3C4D5E6F7G8H9JKMNPQRS';

/** docs 08 §12.2. */
export const BUNDLE_MANIFEST = {
  bundle_schema: 'kp-artifact-bundle-1.0.0',
  bundle_id: 'arif-net-0.3.0__2026-10-18',
  model_version: 'arif-net-0.3.0',
  dataset_version: 'food-price-0.4.0',
  preprocessing_version: 'prep-0.4.0',
  data_cutoff: '2026-10-18T12:00:00+07:00',
  generated_at: '2026-10-18T21:40:00+07:00',
  artifact_status: 'candidate',
  source_commit: 'cb10eca',
  commodities: ['cabai-merah-keriting', 'bawang-merah', 'beras-medium-1'],
  horizons: [1, 3, 7, 14, 30, 90, 180, 365],
  files: [{ path: 'forecasts/cabai-merah-keriting.json', sha256: 'a'.repeat(64), bytes: 18_234 }],
  limitations: ['Perkiraan adalah estimasi model, bukan jaminan harga.'],
};

/** docs 08 §3. */
export const ENVELOPE_PARTS = {
  meta: {
    request_id: `req_${ULID}`,
    schema_version: '1.0.0',
    generated_at: '2026-10-14T07:01:00+07:00',
  },
  provenance: {
    model_version: 'arif-net-0.3.0',
    dataset_version: 'food-price-0.4.0',
    preprocessing_version: 'prep-0.4.0',
    data_cutoff: '2026-10-14T12:00:00+07:00',
    artifact_status: 'candidate',
  },
  availability: {
    price: 'available',
    climate: 'available',
    news: 'available',
    macro_logistics: 'partial',
    calendar: 'available',
  },
  limitations: ['Perkiraan adalah estimasi model, bukan jaminan harga.'],
};
