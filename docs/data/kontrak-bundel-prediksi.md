# Kontrak Bundel Prediksi & Layanan Model

Status: **v1 (11 Nov 2026)**. Mengikat tim produk (Kawan Pasar) dan tim pemodelan (ARIF-Net / pipeline Airflow). Perubahan kontrak wajib disepakati kedua pihak dan dicatat sebagai ADR.

## 1. Struktur bundel

Satu bundel = satu direktori `<bundle_id>/` yang dikirim pipeline (rsync, tulis-saja) ke penyimpanan artefak:

```
<bundle_id>/
├─ forecasts.csv        (atau forecasts.parquet)
├─ metadata.json
└─ SHA256SUMS           checksum SHA-256 untuk dua berkas di atas
```

### `metadata.json`

| Field | Tipe | Wajib | Kolom DB (`forecast_artifacts`) |
|---|---|---|---|
| `bundle_id` | string, unik | ya | `bundle_id` |
| `model_name` | string (mis. `arif-net`) | ya | `model_name` |
| `model_version` | string tidak kosong | ya | `model_version` |
| `data_version` | string tidak kosong | ya | `data_version` |
| `preprocess_version` | string tidak kosong | ya | `preprocess_version` |
| `data_cutoff` | ISO-8601 dengan zona waktu | ya | `data_cutoff` (timestamptz) |
| `issued_at` | ISO-8601 dengan zona waktu | ya | `issued_at` (timestamptz) |

`checksum_sha256` di DB adalah SHA-256 (hex huruf kecil, 64 karakter) dari berkas `forecasts.*`.

### `forecasts.csv`

| Kolom | Tipe | Null | Kolom DB (`forecasts`) | Aturan |
|---|---|---|---|---|
| `market_code` | string | tidak | → `market_id` | Harus ada di katalog (`PIKJ`, …) |
| `commodity_code` | string | tidak | → `commodity_id` | Harus ada di katalog dan berstatus `covered` |
| `base_date` | `YYYY-MM-DD` | tidak | `base_date` | |
| `horizon_days` | integer | tidak | `horizon_days` | ∈ {1, 3, 7, 14, 30, 90, 180, 365} |
| `q10_change`, `q50_change`, `q90_change` | desimal (r(t,h)) | boleh kosong | `q*_change` numeric(9,6) | q10 ≤ q50 ≤ q90 |
| `q10_price_idr`, `q50_price_idr`, `q90_price_idr` | integer rupiah | boleh kosong | `q*_price_idr` | > 0 dan monoton |
| `eval_status` | `available` \| `partial` \| `not_tested` | tidak | `eval_status` | |

Nilai kosong berarti **tidak diketahui**: disimpan NULL dan ditampilkan "—", tidak pernah 0. Satu baris unik per (pasar, komoditas, horizon) dalam satu bundel.

## 2. Verifikasi dan promosi (oleh worker Core API)

Bundel baru masuk sebagai `pending`, lalu dipromosikan menjadi `active` hanya bila **semua** syarat ini terpenuhi:

1. Checksum di `SHA256SUMS` cocok dengan berkasnya.
2. `metadata.json` valid dan semua field wajib terisi.
3. Setiap baris `forecasts` lolos skema: horizon diizinkan, kuantil monoton, kode dikenal.
4. `issued_at` tidak lebih dari 28 hari lalu.

Bila gagal, status menjadi `rejected` (beserta alasan di log), dan bundel `active` sebelumnya **tidak berubah**. Bila berhasil, bundel lama menjadi `retired` dan yang baru `active` dalam satu transaksi. Hanya boleh ada satu bundel `active` per `model_name` (dijaga constraint DB).

Aturan tampil di produk: umur > 8 hari → label "kedaluwarsa"; > 28 hari → disembunyikan; metadata versi tidak lengkap → tidak tampil.

## 3. Tanda tangan permintaan Core API → layanan model (HMAC-SHA256)

Layanan model hanya ada di jaringan internal. Setiap permintaan wajib membawa:

| Header | Isi |
|---|---|
| `X-KP-Timestamp` | Waktu epoch dalam detik (UTC) |
| `X-KP-Nonce` | String acak unik per permintaan (≥ 16 byte, base64url) |
| `X-KP-Signature` | Hex HMAC-SHA256 dengan kunci bersama atas string kanonik di bawah |

String kanonik (dipisah `\n`):

```
METHOD
PATH (termasuk query string, apa adanya)
TIMESTAMP
NONCE
hex(SHA256(body))     ← body kosong = SHA256 dari string kosong
```

Penerima menolak dengan `401` bila: selisih waktu lebih dari ±60 detik, nonce sudah pernah dipakai dalam 120 detik terakhir (disimpan di Valkey), atau tanda tangan tidak cocok. Perbandingan tanda tangan wajib constant-time. Kunci HMAC berbeda dari `SERVICE_TOKEN` dan dirotasi lewat env.

> Catatan: dokumen desain awal hanya menyebut timestamp. `X-KP-Nonce` ditambahkan di kontrak ini karena desain sudah mensyaratkan anti-replay dengan nonce.
