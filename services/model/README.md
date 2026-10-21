# kawan-pasar-model

Model service Kawan Pasar: menyajikan bundle artefak ARIF-Net yang sudah dipublikasikan, **hanya** di jaringan internal (docs 13 Bagian B). Service ini tidak melakukan training, tidak mengakses DB produk, dan tidak punya route publik.

Saat ini berupa **skeleton**: konfigurasi, verifikasi HMAC, log JSON, envelope error, dan probe. Loader bundle, bundle demo, dan `/internal/*` menyusul di PR berikutnya.

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

## Perilaku lain

- **Request ID.** `X-Request-Id` dari api dipakai bila aman (`[A-Za-z0-9_-]{1,64}`). Bila tidak, dibuat `req_<uuid>`. Id ini terikat ke setiap baris log dan dikembalikan di header.
- **Error.** Envelope docs 08 §8. Detail validasi dan stack tidak pernah masuk respons.
- **Tanpa dokumentasi publik.** OpenAPI, `/docs`, dan `/redoc` dimatikan.
- **Versi.** `exclude-newer = "3 days"` menerapkan cooldown yang sama dengan `minimumReleaseAge` di pnpm. FastAPI dikunci `~=0.143.3`, versi terbaru yang lolos cooldown.
