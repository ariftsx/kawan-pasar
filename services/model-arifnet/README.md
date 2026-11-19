# services/model-arifnet

Inferensi **ARIF-Net A0** (v1.1.0) untuk Kawan Pasar. Layanan ini menulis bundel prediksi berversi sesuai [kontrak bundel](../../docs/data/kontrak-bundel-prediksi.md). Ia tidak melatih model. Keputusan dan alasannya ada di [ADR 0012](../../docs/architecture/adr/0012-penerapan-arif-net.md).

## Cara menjalankan

```bash
pnpm model:export   # dari akar repo: ekspor harga → kontainer model-export → promosi bundel
```

Kontainer `model-export` tidak punya jaringan, database, env, maupun port. Satu-satunya masukannya berkas harga yang diekspor CLI API.

## Isi

```
services/model-arifnet/
├─ src/kp_model/       inferensi numpy: fitur (features.py), kalender, jaringan (network.py),
│                      kuantil campuran + ensembel (forecast.py), bundel (bundle.py), CLI
├─ model/              hasil konversi: arifnet-a0.json (konfigurasi, urutan fitur, statistik
│                      praproses, σ, skor validasi, sha256), weights/s0-4.npz, kalender hari
│                      raya (+ perkiraan 2027), LICENSE-ARIF-Net, model_card.json
├─ tools/              convert_from_arifnet.py (dijalankan di lingkungan riset ARIF-Net)
├─ tests/              kesetaraan dengan kode ARIF-Net (fixtures/golden.json), bundel, CLI
└─ artifacts/          bundel yang ditulis (tidak di-commit)
```

## Setelah tim pemodelan melatih ulang

```bash
# di lingkungan riset ARIF-Net (PyTorch), dari akar repo Kawan Pasar:
<python env ARIF-Net> services/model-arifnet/tools/convert_from_arifnet.py "<folder ARIF-Net>"
cd services/model-arifnet && uv run pytest -q   # kesetaraan wajib lulus
pnpm model:export
```

Konverter menolak bobot dan snapshot data yang tidak cocok dengan `model_card.json`. Fixture golden dihitung dari seri harga sintetis, jadi data pasar tidak ikut di-commit.

## Pemeriksaan

```bash
uv run pytest -q --cov=kp_model --cov-fail-under=90
uv run mypy --strict src tests
uv run ruff check && uv run ruff format --check
```

Ketiganya juga bagian dari `pnpm audit:all`.

## Atribusi

ARIF-Net © 2026 Muhamad Nur Arif, lisensi MIT (`model/LICENSE-ARIF-Net`).
