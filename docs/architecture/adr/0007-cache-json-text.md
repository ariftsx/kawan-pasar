# ADR 0007 — Respons baca besar disajikan sebagai teks JSON dari cache

- **Status:** Diterima (12 Nov 2026)

## Konteks

Uji beban Fase 1A (k6, 200 pengguna virtual) mencatat p95 9,75 detik. Profil per endpoint menunjukkan bottleneck pada riwayat `range=all`/`365d` (±400 titik): setiap cache hit menjalankan `JSON.parse` → validasi Zod per titik (termasuk regex tanggal) → `JSON.stringify` ulang. Kapasitasnya hanya 185 req/s, sementara endpoint kecil mencapai 550–830 req/s.

## Opsi

| Opsi                                                              | Kelebihan                                                    | Kekurangan                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Validasi setiap baca (sebelumnya)                                 | Entri cache rusak terdeteksi                                 | Biaya CPU sebanding ukuran respons di setiap hit                      |
| **Validasi saat tulis, kirim teks apa adanya saat hit (dipilih)** | Hit = satu `GET` Valkey + kirim string; kapasitas riwayat 2× | Entri yang dirusak langsung di Valkey tidak terdeteksi saat baca      |
| Serializer skema Fastify                                          | Stringify lebih cepat                                        | Tetap parse + stringify setiap hit; skema ganda (Zod dan JSON Schema) |

## Keputusan

`CacheService.getOrLoadJson()` dipakai untuk ringkasan harga, riwayat, dan artikel:

- **Miss:** `load()` → `schema.parse()` (kontrak ditegakkan) → `JSON.stringify` → `SET` dengan TTL → teks dikirim.
- **Hit:** teks dari Valkey dikirim apa adanya dengan `content-type: application/json`.
- Kunci `kp:v1:json:<scope>:…` ikut terhapus oleh invalidasi scope. Pola `SCAN` eksplisit per jenis kunci, sehingga kunci rate limit tidak pernah ikut terhapus.

Prediksi tetap memakai `getOrLoad()` (objek), karena status 8/28 hari harus dihitung ulang setiap permintaan dari waktu sekarang.

## Risiko yang diterima

Valkey cache ada di jaringan internal, dilindungi password, dan hanya ditulisi oleh `CacheService`. Pihak yang bisa menulis ke Valkey sudah berada di dalam infrastruktur. Entri yang dirusak akan tersaji paling lama sampai TTL habis (1–6 jam) atau sampai invalidasi berikutnya.

## Hasil terukur (laptop dev, 1 replika, k6 di mesin yang sama)

- Riwayat `all`: 185 → 375 req/s.
- Skenario campuran 200 pengguna virtual: p95 9,75 detik → 378 ms; galat 0%.
