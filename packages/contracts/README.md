# @kawan-pasar/contracts

Kontrak wire format (docs 08) dalam bentuk skema [zod 4](https://zod.dev) dan tipe TypeScript. Dipakai di setiap batas sistem: BFF ↔ api, api ↔ model-svc, dan worker ↔ bundle artefak.

| Modul        | Isi                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------- |
| `primitives` | Tanggal pasar, timestamp ber-offset, rupiah, rasio, slug, `prefixedId()`, SemVer, SHA-256 |
| `enums`      | Kosakata terkontrol (§4) + `HorizonDay`                                                   |
| `errors`     | `ERROR_STATUS` (kode → HTTP) dan `ApiError`                                               |
| `envelope`   | `successEnvelope(data)`, `ErrorEnvelope`, `Provenance`, `ModalityAvailability`            |
| `market`     | `PriceObservation`, `Forecast`, `MovementThreshold` (Q95 statistik), `AlertEvent`         |
| `cost`       | `Menu`, `MenuCost`, `MenuWithCost`, dengan invarian modal parsial                         |
| `bundle`     | `BundleManifest` untuk bundle mingguan ARIF-Net (§12.2)                                   |

## Aturan

- **Wire = `snake_case`.** Tipe domain (`@kawan-pasar/domain`) memakai `camelCase`; pemetaannya tugas presenter di api.
- **Semua objek strict.** Field yang tidak dikenal ditolak.
- **`null`, bukan absen dan bukan 0.** Nilai yang tidak diketahui selalu dikirim sebagai `null`.
- **Invarian dicek di skema:** bahan tanpa harga wajib `null`, `coverage` harus cocok dengan `items`, dan margin wajib `null` saat modal parsial.

```ts
import { MenuWithCost, successEnvelope } from '@kawan-pasar/contracts';

const MenuCostResponse = successEnvelope(MenuWithCost);
const result = MenuCostResponse.safeParse(json);
```

Contoh di `src/*-examples.fixture.ts` adalah salinan contoh docs 08. Test memastikan keduanya tetap cocok.
