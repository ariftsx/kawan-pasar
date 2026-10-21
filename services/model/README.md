# kawan-pasar-model

Model service Kawan Pasar: menyajikan bundle artefak ARIF-Net yang sudah dipublikasikan, **hanya** di jaringan internal (docs 13 Bagian B). Service ini tidak melakukan training, tidak mengakses DB produk, dan tidak punya route publik.

Saat ini service menyajikan **bundle demo** dalam mode pengembangan (DH-03) lewat route `/internal/*` yang dilindungi HMAC. Inference live dan `/internal/thresholds` belum ada: peringatan memakai Q95 statistik produk (D-22), dan inference menunggu artefak ARIF-Net.

## Menjalankan

Prasyarat: Python 3.14 dan [uv](https://docs.astral.sh/uv/) ≥ 0.13.

```bash
cd services/model
uv sync                                    # .venv dari uv.lock
uv run uvicorn --factory app.main:app --port 8000 --env-file .env
uv run pytest                              # coverage minimal 90%
uv run ruff format --check . && uv run ruff check .
uv run pyright                             # strict untuk app/
uv export --no-dev --no-hashes > /tmp/req.txt && uv run pip-audit -r /tmp/req.txt
```

Image produksi nanti memakai `--workers 1 --proxy-headers` (docs 13 §B3). Uvicorn dipanggil langsung, tanpa `fastapi-cli`, agar dependensi lebih sedikit.

| Env                     | Wajib | Default       | Isi                                              |
| ----------------------- | ----- | ------------- | ------------------------------------------------ |
| `MODEL_HMAC_SECRET`     | ya    | —             | Secret HMAC bersama `apps/api`, ≥ 32 karakter    |
| `OUTLOOK_MODE`          | tidak | `development` | `development` (bundle demo berlabel) atau `live` |
| `ARTIFACTS_DIR`         | tidak | `/artifacts`  | Volume read-only berisi `current/`               |
| `HMAC_MAX_SKEW_SECONDS` | tidak | `60`          | Selisih jam maksimum (1–300 detik)               |
| `LOG_LEVEL`             | tidak | `info`        | `debug` · `info` · `warning` · `error`           |

Settings divalidasi pydantic-settings saat start. Bila ada yang salah, proses berhenti dengan nama field, tanpa menampilkan nilainya (`hide_input_in_errors`).

## Tanda tangan HMAC

Setiap route `/internal/*` mewajibkan dua header:

```text
X-KP-Timestamp: <detik Unix>
X-KP-Signature: hex(HMAC-SHA256(secret, "<timestamp>\n<METHOD>\n<path?query>\n<sha256_hex(body)>"))
```

Request ditolak (`401 UNAUTHENTICATED`) bila salah satu header tidak ada, timestamp di luar ±60 detik, atau tanda tangan tidak cocok. Perbandingan memakai `hmac.compare_digest`. Method dan path ikut ditandatangani, sehingga tanda tangan yang tertangkap tidak bisa dipakai ulang ke route lain. `/healthz` dan `/readyz` tidak memerlukan tanda tangan.

## Route internal

| Method | Path                                      | Isi                                                                                                 |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/internal/forecasts/{commodity}?origin=` | Forecast (docs 08 §5.3) + `provenance`, `availability`, `limitations`, `outlook_status`             |
| GET    | `/internal/artifacts/manifest`            | Manifest bundle yang sedang disajikan                                                               |
| POST   | `/internal/artifacts/reload`              | Memuat ulang setelah promosi. Bila gagal, bundle lama tetap dipakai (`422 SCHEMA_INVALID` + alasan) |

Komoditas di luar bundle → `404 ARTIFACT_NOT_FOUND`. Origin berbeda atau belum ada bundle → `503 FORECAST_UNAVAILABLE`.

| `OUTLOOK_MODE` | Sumber                                            | `outlook_status`                                                    |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `development`  | `demo/demo__2026-10-18/` (ikut di repo)           | `in_development`                                                    |
| `live`         | `$ARTIFACTS_DIR/current` → `releases/<bundle_id>` | `candidate` atau `available`; `missing` bila tidak ada bundle valid |

Bundle dimuat saat start dan ditukar secara atomik saat reload. Verifikasi berjalan di thread terpisah dan reload diserialkan dengan lock. Start tanpa bundle valid tidak menghentikan service: `/readyz` tetap 200 dengan `outlook = missing` (AP-08).

## Bundle

`app/artifacts/loader.py` memverifikasi satu folder bundle (docs 08 §12) sebelum dipakai:

- skema manifest valid, dan nama folder sama dengan `bundle_id`;
- setiap file tercantum di manifest, berada di dalam bundle, dengan ukuran dan SHA-256 yang cocok (maks 5 MB per file);
- identitas run sama dengan manifest, `origin ≤ data_cutoff`, dan horizon termasuk yang didukung;
- `predicted_price_idr` = rekonstruksi `reference × (1 + change)`, dibulatkan setengah ke atas seperti di `packages/domain`;
- mode `development` hanya menerima bundle `model_version = demo` berstatus `draft`; mode `live` menolak bundle demo dan status di bawah `candidate`.

Pesan penolakan hanya menyebut lokasi field. Nilai dari bundle tidak pernah ditampilkan.

**Bundle demo** (`demo/demo__2026-10-18/`) dibangun ulang dengan `uv run python -m scripts.build_demo_bundle`. Hasilnya deterministik, jadi git harus tetap bersih setelah dijalankan. Semua angkanya **DATA DEMO**, sama dengan kartu demo di `apps/web` (perubahan 7 hari: cabai +2,8%, bawang +0,9%, beras 0%). Horizon lain hanya diskalakan `sqrt(h / 7)` agar grafik punya bentuk, **bukan** hasil model. Folder `demo/` dikecualikan dari Prettier karena isinya dichecksum.

## Perilaku lain

- **Request ID.** `X-Request-Id` dari api dipakai bila aman (`[A-Za-z0-9_-]{1,64}`). Bila tidak, dibuat `req_<uuid>`. Id ini terikat ke setiap baris log dan dikembalikan di header.
- **Error.** Envelope docs 08 §8. Detail validasi dan stack tidak pernah masuk respons.
- **Tanpa dokumentasi publik.** OpenAPI, `/docs`, dan `/redoc` dimatikan.
- **Versi.** `exclude-newer = "3 days"` menerapkan cooldown yang sama dengan `minimumReleaseAge` di pnpm. FastAPI dikunci `~=0.143.3`, versi terbaru yang lolos cooldown.
