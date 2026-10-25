# Berkontribusi ke Kawan Pasar

## Alur kerja

1. Buat branch dari `main`. Nama branch mengikuti jenis perubahan, mis. `feat/pantau-harga`, `fix/margin-null`, `docs/readme`, atau `ci/cache`.
2. Commit memakai **[Conventional Commits](https://www.conventionalcommits.org/)** (`feat(web): …`, `fix(api): …`). Formatnya diperiksa commitlint.
3. Buka PR ke `main`. Satu PR = satu perubahan yang koheren, idealnya **≤ 400 baris** di luar lockfile dan file generated. Pekerjaan besar dipecah menjadi beberapa PR.
4. CI harus hijau. PR digabung dengan **squash merge** oleh pemilik produk.

**PR bertumpuk** (PR B dibangun di atas branch PR A):

- Sebelum PR A di-merge, ubah base PR B ke `main` (`gh pr edit <B> --base main`). Bila base branch PR B terhapus lebih dulu, GitHub menutup PR B dan PR itu tidak bisa dibuka lagi.
- Setelah PR A di-squash merge, rebase PR B dengan `git rebase --onto origin/main <tip lama A> <branch B>`, lalu push dengan `--force-with-lease`.

Git hooks (lefthook) dipasang otomatis oleh `pnpm install`:

| Hook       | Isi                                       |
| ---------- | ----------------------------------------- |
| pre-commit | Prettier + ESLint pada file yang di-stage |
| commit-msg | commitlint                                |
| pre-push   | `pnpm run check`                          |

## Perintah penting

| Perintah                         | Fungsi                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| `pnpm run check`                 | Lint + typecheck + unit test semua paket (Turborepo)                    |
| `pnpm run build`                 | Build semua paket dan aplikasi                                          |
| `pnpm format`                    | Prettier untuk seluruh repo                                             |
| `pnpm stack:up` / `stack:down`   | Stack Docker lokal                                                      |
| `pnpm --filter <paket> <script>` | Script untuk satu paket, mis. `pnpm --filter @kawan-pasar/web test:e2e` |
| `uv run pytest`                  | Test Python di `services/model` atau `services/ingest`                  |

## Aturan yang tidak boleh dilanggar

Aturan ini dijaga oleh review dan, sebisa mungkin, oleh test atau lint.

**Data dan angka**

1. **Uang = integer rupiah.** Tidak ada `float` untuk uang. Perhitungan modal hanya ada di `packages/domain`.
2. **Tidak tahu ≠ 0.** Nilai yang tidak ada adalah `null` dan tampil "—" plus teks. Tidak pernah tampil `Rp 0`.
3. **Data contoh selalu berlabel DATA DEMO.** Jangan tampilkan angka contoh atau metadata demo seolah hasil model.
4. **Tidak ada klaim kausal** ("hujan menyebabkan harga naik") dan **tidak ada saran** membeli, menjual, menyetok, atau mengubah menu.
5. **Perkiraan tanpa versi tidak boleh tampil.** Setiap perkiraan wajib membawa provenance dan bisa ditelusuri dalam 1 klik.

**UI**

6. **Token saja.** Tidak ada warna hex dan tidak ada nilai Tailwind arbitrer (`z-[100]`, `max-w-[1280px]`). Kalau butuh nilai baru, tambahkan token di `packages/tokens`.
7. **Aksesibilitas:** WCAG 2.2 AA, arah harga ditandai dengan panah dan tanda (bukan hanya warna), target sentuh ≥ 44 px. Test e2e menjalankan axe di setiap layar.

**Keamanan dan operasi**

8. **Secret** hanya di env server. `NEXT_PUBLIC_*` tidak boleh berisi secret. File `.env` tidak pernah di-commit.
9. **Biaya operasional nol.** Layanan atau API berbayar tidak boleh ditambahkan tanpa persetujuan pemilik produk.

## Dependensi

- Versi baru hanya boleh dipasang setelah **berumur ≥ 3 hari**. pnpm (`minimumReleaseAge`), uv (`exclude-newer = "3 days"`), dan Renovate menegakkan aturan ini otomatis.
- Sebelum menambah dependensi:
  - pastikan fiturnya tidak bisa dibuat dengan stack yang ada;
  - periksa lisensi dan pemeliharaannya;
  - jelaskan alasannya di PR.
- Cek dokumentasi terbaru library, jangan hanya mengandalkan ingatan. Contoh: `ORJSONResponse` di FastAPI sudah deprecated, dan `Switch` di react-aria-components diganti `SwitchField` + `SwitchButton`.

## Test

| Lapisan                                            | Alat                                    | Lokasi                          |
| -------------------------------------------------- | --------------------------------------- | ------------------------------- |
| Logika murni (domain, contracts, catalog, lib web) | Vitest, ambang coverage ≥ 90%           | `src/**/*.test.ts`              |
| Komponen UI                                        | Vitest + Testing Library (happy-dom)    | `packages/ui/src/**/*.test.tsx` |
| API                                                | Vitest + `fastify.inject`               | `apps/api/src/**/*.test.ts`     |
| Alur pengguna                                      | Playwright (desktop + HP 360×740) + axe | `apps/web/e2e/`                 |
| Python                                             | pytest, ruff, pyright strict            | `services/*/tests/`             |

Bug yang ditemukan di UI diberi test regresi. Contohnya test nilai stepper di `golden-path.spec.ts`.

## Jebakan yang sudah pernah terjadi

- **React Aria `NumberField`** membulatkan nilai ke kelipatan `step` yang dihitung dari `minValue`. `minValue=1` dengan `step=5` mengubah 120 menjadi 121.
- **Komponen `packages/ui`** yang memakai react-aria-components wajib diawali `'use client'`. Tanpa itu, build Next gagal di Server Component.
- **Folder bundle demo** `services/model/demo/` dikecualikan dari Prettier karena isinya dichecksum. Bundle dibangun ulang dengan `uv run python -m scripts.build_demo_bundle`.
- **Corepack di Node 24.11** belum bisa menjalankan pnpm 12. Dockerfile dan CI memasang pnpm dengan `npm i -g pnpm@12.14.0`.
- **Git Bash di Windows:** pakai `MSYS_NO_PATHCONV=1` untuk path `docker -v` dan `--tmpfs`.
- **Turbo dan Next:** `next typegen` (typecheck) dan `next build` sama-sama menulis ke `.next`, jadi build web dibuat menunggu typecheck web di `turbo.json`. Tanpa itu, CI kadang gagal dengan `ENOENT .next/types/routes.d.ts`.
