# @kawan-pasar/config

Konfigurasi bersama untuk seluruh paket TypeScript di monorepo, mengikuti standar kode produk (docs 14 · Coding Standards).

| Ekspor                                      | Isi                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@kawan-pasar/config/tsconfig/base.json`    | Compiler strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, …)                      |
| `@kawan-pasar/config/tsconfig/library.json` | Base + emit `dist/` dengan deklarasi                                                                                       |
| `@kawan-pasar/config/eslint`                | `defineBaseConfig()`: typescript-eslint `strictTypeChecked`, import-x (`no-cycle`, `order`), security, larangan hex & enum |
| `@kawan-pasar/config/prettier`              | Format bersama (lebar 100, single quote, LF)                                                                               |
| `@kawan-pasar/config/vitest`                | `defineVitestConfig()`: coverage v8 dengan ambang default 90%                                                              |

## Pemakaian

```js
// eslint.config.js di paket
import { defineBaseConfig } from '@kawan-pasar/config/eslint';

export default defineBaseConfig({ tsconfigRootDir: import.meta.dirname });
```

```json
// tsconfig.json di paket
{ "extends": "@kawan-pasar/config/tsconfig/library.json", "include": ["src"] }
```

## TypeScript 6 dan 7 berdampingan

Pola resmi TypeScript 7 untuk alat yang memakai Compiler API:

- `typescript@6.0.x`: dipakai typescript-eslint, yang belum mendukung TS 7.
- `@typescript/native` (`npm:typescript@7`): dipakai untuk `tsc` (typecheck dan build).

Keduanya dipasang di root workspace. Script `typecheck` memanggil compiler TS 7.
