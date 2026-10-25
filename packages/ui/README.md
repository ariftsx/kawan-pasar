# @kawan-pasar/ui

Komponen design system "Kawan" (docs 10, 11). Dibangun di atas **react-aria-components** (P-04) untuk fokus, keyboard, dan ARIA. Styling hanya memakai token (`@kawan-pasar/tokens`): tidak ada hex dan tidak ada nilai Tailwind arbitrer (AGENTS §41.7).

| Lapisan         | Komponen                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `primitives/`   | Button, ButtonLink, Chip, NumberStepper, Slider, StepItem, Switch, TextField                      |
| `data-display/` | Card, Callout, DataStatus, DemoBadge, MetricCard, MovementBadge, EmptyState, ErrorState, Skeleton |

Aturan yang dijaga komponen:

- Arah harga selalu ditampilkan dengan panah dan tanda, tidak hanya warna (`MovementBadge`). Perubahan yang tampil sebagai `0,0%` tidak pernah digambar naik atau turun.
- Nilai yang tidak ada tampil sebagai "—" + teks, tidak pernah `Rp 0` (`MetricCard`, UX-04).
- Teks `DATA DEMO` tidak bisa diubah oleh pemanggil (`DemoBadge`).
- `ErrorState` menampilkan `request_id`, tidak pernah stack trace.
- Target sentuh minimal 44 px untuk ukuran `md`.

Komponen tidak memformat angka. Aplikasi mengirim teks yang sudah diformat `id-ID` (mis. `"+3,2%"`).

## Pemakaian di apps/web

Tailwind di aplikasi harus memindai sumber paket ini:

```css
@source '../../../../packages/ui/src';
```

## Test

```bash
pnpm --filter @kawan-pasar/ui test   # Vitest + Testing Library (happy-dom)
```
