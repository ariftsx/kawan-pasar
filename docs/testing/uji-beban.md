# Uji Beban (k6)

Skrip ada di `tests/load/`. k6 dijalankan di dalam jaringan `kp-backend` **sebagai kontainer web** (`--ip 172.30.0.10`, satu-satunya proxy tepercaya), dan setiap pengguna virtual mengirim `X-Forwarded-For` sendiri. Ini meniru jalur produksi: browser → Traefik → web (BFF) → API.

## Menjalankan

```bash
S=$(grep '^SERVICE_TOKEN=' .env | cut -d= -f2-)
# kosongkan cache agar uji dimulai dingin
curl -s -X POST -H "x-service-token: $S" -H content-type:application/json \
  -d '{"scope":"all"}' http://127.0.0.1:3001/internal/cache/invalidate
MSYS_NO_PATHCONV=1 docker run --rm --network kp-backend --ip 172.30.0.10 \
  -e SERVICE_TOKEN="$S" -v "$PWD/tests/load:/scripts:ro" \
  grafana/k6:2.3.0 run /scripts/api-public.js
```

Kontainer web (Fase 1B+) memakai alamat yang sama. Jalankan uji API ini **sebelum** kontainer web menyala, atau ganti `--ip` dengan alamat yang ditambahkan ke `TRUSTED_PROXY_IPS`.

| Skrip               | Isi                                                                                                                                               | Sasaran                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `api-public.js`     | 200 pengguna × 60 detik; setiap iterasi: ringkasan + riwayat (4 rentang bergilir) + prediksi, jeda 1,6 detik (di bawah batas 120/menit per klien) | 0% galat; p95 < 100 ms (lihat hasil)                                   |
| `api-rate-limit.js` | 1 klien mengirim 150 permintaan beruntun, ditambah 1 klien lain                                                                                   | Klien rakus ≤ 120 sukses dan sisanya 429; klien lain tidak terpengaruh |

Jumlah query DB selama uji diukur dari `pg_stat_database` (`xact_commit + xact_rollback`) sebelum dan sesudah.

## Hasil Fase 1A (12 Nov 2026, laptop dev: Windows 11, Docker Desktop 4 vCPU, k6 di mesin yang sama)

| Kondisi                                       | Permintaan | Galat  | Median | p95        | Transaksi DB          |
| --------------------------------------------- | ---------- | ------ | ------ | ---------- | --------------------- |
| Sebelum optimasi                              | 5.853      | 0,10%  | —      | 9,75 s     | 52                    |
| Setelah cache JSON-text (ADR 0007), 1 replika | 20.082     | **0%** | 47 ms  | **378 ms** | **34**                |
| Rate limit                                    | 150        | —      | —      | —          | 120 × 200, 30 × 429 ✔ |

**Sasaran p95 < 100 ms belum tercapai di perangkat ini.** Hal-hal yang sudah dibuktikan:

- Baseline server Node polos di jaringan Docker yang sama: 4,6 rb req/s. Satu replika API: 0,4–1,1 rb req/s per rute ringan (overhead NestJS + Fastify + helmet + logging).
- Uji 2 replika **tidak meningkatkan** hasil, karena k6 (200 pengguna virtual), kedua replika, Valkey, dan PostgreSQL berebut 4 vCPU yang sama. Skalabilitas horizontal tidak bisa diukur di laptop ini.
- Database tetap hampir tidak tersentuh (34 transaksi untuk ±20 rb permintaan), sehingga bottleneck-nya CPU proses API, bukan database.

Validasi ulang dijadwalkan di Fase 1D, dengan k6 dijalankan di mesin terpisah atau di server, dan terhadap keseluruhan tumpukan. Di sana sebagian besar permintaan halaman publik dilayani cache Next.js tanpa memanggil API sama sekali.
