# Rencana Fase 5 — Deployment Produksi ke VPS

- Tanggal: 25 November 2026
- Status: **disetujui pemilik 25 Nov 2026** (K1 Brevo, K2 snapshot + Google Drive terenkripsi, K3 Airflow selalu menyala, K4 admin lewat CLI)
- Prasyarat: Fase 4C (commit `2f56420`, audit 23/23)
- Keputusan pemilik (25 Nov 2026): VPS Hostinger KVM 2 (2 vCPU, 8 GB RAM, 100 GB NVMe), Ubuntu 24.04 LTS, akses SSH dengan kunci, alamat `kawanpasar.ariftsx.id` (domain dari IDCloudHost), kode ditarik dari GitHub `ariftsx/kawan-pasar`

## Tujuan

Kawan Pasar berjalan di VPS seperti di laptop, dengan fitur dan tujuan yang sama:

- situs publik dan akun;
- prediksi ARIF-Net;
- Mode Analis dan admin;
- pipeline harian dan latih ulang di Airflow, dengan kunci uji prospektif.

Bedanya, versi produksi memakai HTTPS, email sungguhan, cadangan rutin, dan server yang dikeraskan. Tidak ada fitur yang dikurangi.

## Kapasitas (diukur di laptop)

| Bagian                      | Diam        | Puncak                                                   |
| --------------------------- | ----------- | -------------------------------------------------------- |
| Stack produk (11 kontainer) | ~0,5 GB     | ~2,5 GB (jumlah batas memori)                            |
| Airflow (3 kontainer)       | ~0,6 GB     | ~1–3 GB saat latih ulang (run penuh 4C: ±1 GiB tercatat) |
| Ubuntu + Docker             | ~0,5 GB     | ~0,5 GB                                                  |
| **Total**                   | **~1,6 GB** | **~4–6 GB dari 8 GB**                                    |

- **CPU 2 vCPU:** bagian yang paling pas-pasan. Latih ulang dibatasi 1,5 CPU dan dijadwalkan pukul 02.00 WIB. Uji beban diulang di VPS, karena angka 500 pengguna serentak dari Fase 1D diukur di laptop.
- **Disk 100 GB:** image sekitar 10 GB, data di bawah 1 GB, dan tiap run latih ulang sekitar 200 MB.

## Keputusan yang diminta

| #   | Pertanyaan              | Usulan                                                                                                                                                                                 |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Penyedia email          | **Brevo** (paket gratis 300 email/hari, SMTP biasa). Pemilik membuat akun sendiri; record SPF, DKIM, dan DMARC ditambahkan di DNS IDCloudHost dengan panduan. Alternatif: Resend       |
| K2  | Cadangan di luar server | **Snapshot mingguan Hostinger + `pg_dump` harian** di VPS (simpan 14 hari) yang disalin ke Google Drive pemilik (folder khusus, dienkripsi `age`). Alternatif: hanya di VPS + snapshot |
| K3  | Airflow di produksi     | **Selalu menyala** (profil `airflow`). UI hanya lewat SSH tunnel; admin memakai halaman Pipeline/Model                                                                                 |
| K4  | Akun admin pertama      | Dibuat lewat CLI di server (`admin:grant`), bukan dari web; email pemilik dimasukkan pemilik sendiri saat langkah itu                                                                  |

## Tugas

| #   | Tugas                                                                                                                                                                                                                                                                                                                                            | Verifikasi                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1   | **Pengerasan server:** pengguna `kawan` (sudo) dengan kunci SSH; login root dan login sandi dimatikan; `ufw` (22, 80, 443); `fail2ban`; `unattended-upgrades`; swap 4 GB; zona waktu UTC (aplikasi memakai WIB sendiri); Docker Engine + compose plugin dari repo resmi Docker                                                                   | `ssh` sandi ditolak, `ufw status`, `docker version`          |
| 2   | **Compose produksi** (`infra/compose/docker-compose.prod.yml`, dipakai lewat `scripts/compose.mjs --prod`): Traefik 80/443 dengan Let's Encrypt (HTTP-01), pengalihan HTTP→HTTPS, HSTS; tanpa Mailpit dan port dev-tools; SMTP sungguhan; `PUBLIC_SITE_URL=https://kawanpasar.ariftsx.id`; batas CPU/memori untuk 2 vCPU/8 GB; rotasi log Docker | `compose config`, uji di laptop dengan profil prod tanpa TLS |
| 3   | **Rahasia di server:** `.env` produksi dibuat di VPS oleh `gen-env` (tidak pernah keluar dari server, izin 600); kredensial SMTP diisi pemilik                                                                                                                                                                                                   | Pemindaian: tidak ada rahasia di repo atau log               |
| 4   | **Data awal:** migrasi skema, katalog, riwayat harga (`data/seed`, gudang PIHPS, riwayat cabai rawit), bundel ARIF-Net aktif, artikel, akun admin (K4). Berkas data dikirim lewat `scp` dari laptop (tidak lewat git)                                                                                                                            | Halaman harga dan prediksi sama dengan laptop                |
| 5   | **Skrip deploy** (`scripts/deploy.sh`): `git pull` → build satu per satu → migrasi → `up -d --wait` → pemeriksaan sehat; image sebelumnya diberi tag agar bisa dikembalikan (`deploy.sh --rollback`)                                                                                                                                             | Deploy ulang tanpa henti >30 detik; rollback diuji           |
| 6   | **Cadangan (K2):** `pg_dump` harian + rotasi 14 hari; salinan terenkripsi ke luar server; **uji pulihkan** ke database sementara                                                                                                                                                                                                                 | Pemulihan berhasil dan jumlah baris cocok                    |
| 7   | **Pemantauan ringan:** `infra:check` versi produksi tiap 5 menit (cron) yang mengirim email saat ada kegagalan; batas ukuran log                                                                                                                                                                                                                 | Email peringatan diterima saat satu kontainer dimatikan      |
| 8   | **DNS dan email:** A record `kawanpasar` → IP VPS di IDCloudHost; SPF, DKIM, dan DMARC untuk pengirim `noreply@ariftsx.id` (K1)                                                                                                                                                                                                                  | Sertifikat HTTPS terbit; email verifikasi masuk inbox Gmail  |
| 9   | **Verifikasi produksi:** e2e smoke terhadap `https://kawanpasar.ariftsx.id` (subset yang tidak mengubah data penting), Lighthouse, pemindaian port dari luar, header keamanan, uji beban dari laptop (k6, naik bertahap, dihentikan bila p95 > 1 s)                                                                                              | Laporan `docs/audits/fase-5.md`                              |
| 10  | ADR 0018 (topologi produksi), runbook operasi (`docs/operations/produksi.md`: deploy, rollback, cadangan, pulihkan, buka kunci prospektif, rotasi rahasia), tinjauan independen, saran commit tanpa atribusi                                                                                                                                     | —                                                            |

## Keamanan

- Hanya port 22, 80, dan 443 yang terbuka ke internet. PostgreSQL, Valkey, API, dan Airflow hanya ada di jaringan Docker internal.
- SSH hanya dengan kunci. Saya tidak pernah mengetik kata sandi akun atau layanan; kredensial SMTP dan email admin dimasukkan pemilik sendiri.
- `.env` produksi, `OPENED.json`, dan `REGISTERED.json` tidak pernah masuk git atau image.
- Setiap langkah yang mengubah server atau DNS dikonfirmasi lebih dulu.

## Yang diperlukan dari pemilik

1. IP VPS.
2. Izin membuat kunci SSH `~/.ssh/kawanpasar_vps` (ed25519) di laptop ini. Lalu pasang kunci publiknya di VPS lewat panel Hostinger: VPS → Settings → SSH keys, atau `ssh-copy-id` dengan sandi root yang Anda ketik sendiri.
3. `git push` cabang `main` ke GitHub (saat ini 40 commit di depan `origin`), dan informasi apakah repo private atau public. Bila private, deploy key baca-saja ditambahkan di GitHub.
4. Keputusan K1–K4.
