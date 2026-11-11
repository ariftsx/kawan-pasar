# ADR 0002 — TypeScript 6.0, bukan 7.0

- **Status:** Diterima (11 Nov 2026)

## Konteks

Versi TypeScript terbaru per 11 Nov 2026 adalah 7.0.2, yaitu compiler native. Pemilik meminta versi terbaru yang stabil **dan kompatibel** dengan seluruh library.

Hasil cek peer dependency:

- `typescript-eslint@8.72.2`: `typescript >=4.8.4 <6.1.0`
- `@nestjs/cli@12.0.12`: mengunci `typescript ~6.0.2`

## Opsi

| Opsi     | Kelebihan                                                       | Kekurangan                                                                                                                    |
| -------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TS 7.0.2 | Kompilasi jauh lebih cepat                                      | Linting bertipe (typescript-eslint) tidak didukung, sehingga aturan "tanpa `any`" tidak bisa ditegakkan; Nest CLI tidak cocok |
| TS 6.0.3 | Kompatibel penuh; semua aturan strict dan lint bertipe berjalan | Kompilasi lebih lambat dari TS 7                                                                                              |

## Keputusan

TypeScript **6.0.3** di semua workspace. Preset tsconfig bersama ada di `@kawan-pasar/tsconfig` dengan `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`, `noPropertyAccessFromIndexSignature`, dan `verbatimModuleSyntax`.

## Konsekuensi

Tinjau ulang saat typescript-eslint dan NestJS CLI mendukung TS 7.
