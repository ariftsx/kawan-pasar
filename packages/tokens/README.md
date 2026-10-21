# @kawan-pasar/tokens

Sumber tunggal design token Kawan Pasar (format [DTCG](https://www.designtokens.org/)), versi **1.0.0** (docs 10 dan 11).

| Lapisan               | File                                | Dipakai oleh                                        |
| --------------------- | ----------------------------------- | --------------------------------------------------- |
| Primitive             | `src/tokens/primitives.tokens.json` | Hanya token semantic, **tidak pernah** komponen     |
| Semantic (Light/Dark) | `src/tokens/semantic.tokens.json`   | Komponen dan layar                                  |
| Skala                 | `src/tokens/scale.tokens.json`      | Spacing, radius, layout, elevation, motion, z-index |

Dark mode ditulis di `$extensions["kp.theme"].dark` pada token yang sama, jadi Light dan Dark selalu bergerak bersama.

## Output build (`pnpm --filter @kawan-pasar/tokens build`)

| Ekspor                           | Isi                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@kawan-pasar/tokens/tokens.css` | Variabel runtime `--kp-*`: Light di `:root`, Dark di `[data-theme="dark"]` dan `prefers-color-scheme: dark`, serta motion 0 ms untuk `prefers-reduced-motion` |
| `@kawan-pasar/tokens/theme.css`  | Tailwind v4 `@theme inline`: `--color-bg-brand: var(--kp-color-bg-brand)` dst. Default Tailwind direset, jadi hanya token yang tersedia                       |
| `@kawan-pasar/tokens`            | `resolveSemanticColors(theme)`, `contrastRatio()`, `auditContrast()` (untuk chart/canvas dan audit)                                                           |

```css
/* apps/web/src/styles/globals.css */
@import 'tailwindcss';
@import '@kawan-pasar/tokens/tokens.css';
@import '@kawan-pasar/tokens/theme.css';
```

Variabel runtime memakai prefiks `--kp-` supaya mapping `@theme` tidak mereferensikan dirinya sendiri.

## Gerbang kontras (CI)

`CONTRAST_PAIRS` mendaftarkan pasangan foreground/background beserta ambang WCAG (4.5 untuk teks, 3 untuk non-teks). Test gagal bila satu pasangan saja di bawah ambang, di Light maupun Dark. Test build juga memastikan nilai di `tokens.css` sama persis dengan nilai yang diaudit.

## Mengubah token

1. Ubah file `src/tokens/*.tokens.json` (satu token per baris; file ini tidak diformat Prettier).
2. Bila menambah pasangan teks/latar baru, daftarkan di `CONTRAST_PAIRS`.
3. Jalankan `pnpm --filter @kawan-pasar/tokens test build`.
4. Sinkronkan ke Figma (koleksi `Primitives`, `Color · Light`, `Color · Dark`).
