# Kawan Pasar

> Perencana modal menu dan risiko harga bahan pangan untuk warung dan UMKM kuliner.

**Status:** pra-implementasi. Kode belum tersedia.

## Apa itu Kawan Pasar

Kawan Pasar membantu pemilik warung menjawab satu pertanyaan sederhana: *"Berapa modal per porsi menu saya hari ini dan minggu depan?"*

- **Rencana Menu**: modal per porsi dan modal harian, berdasarkan harga bahan terbaru.
- **Pantau Harga**: harga terkini, riwayat, dan perubahan bahan pangan. Data bukan real-time; tanggal observasi selalu ditampilkan.
- **Peringatan**: notifikasi saat harga bergerak di luar kebiasaan (in-app dan Web Push).
- **Outlook Harga ★**: perkiraan perubahan harga dari model riset **ARIF-Net** untuk komoditas yang dimodelkan. Bahan lain diberi label "tanpa perkiraan".
- **Mode tamu**: bisa dipakai tanpa login. Data disimpan di perangkat dan dapat disinkronkan ke akun Google.

Segmen inti: warung dan UMKM kuliner. Ekspansi: dapur SPPG.

## Hubungan dengan ARIF-Net

Model perkiraan dikembangkan di repo riset [ARIF-Net](https://github.com/ariftsx/ARIF-Net). Kawan Pasar memakai artefak model berversi dari pipeline mingguan riset tersebut. Ingest harga harian berjalan terpisah di sisi produk.

## Rencana teknologi

| Lapisan | Teknologi |
| --- | --- |
| Web (UI + BFF) | Next.js, React, TypeScript |
| Backend inti | NestJS (modular monolith) |
| Layanan model | FastAPI (internal) |
| Data | PostgreSQL, Valkey |
| Infrastruktur | VPS Linux + Dokploy (Docker), Cloudflare |

## Pengembangan lokal

Prasyarat: Node.js 24 LTS (lihat `.nvmrc`) dan pnpm 12. Versi pnpm dikunci di `packageManager`; pnpm ≥ 9.7 otomatis beralih ke versi itu.

```bash
pnpm install        # memasang dependensi dan git hooks (lefthook)
pnpm run check      # lint, typecheck, dan test di semua paket (Turborepo)
```

Commit memakai format [Conventional Commits](https://www.conventionalcommits.org/), diperiksa oleh commitlint. Dependensi hanya dipasang bila versinya sudah terbit ≥ 3 hari (`minimumReleaseAge`).

## Lisensi

Dilisensikan di bawah [Apache License 2.0](LICENSE).
