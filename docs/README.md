# Knowledge Base Kawan Pasar

Sumber kebenaran proyek. Jika kode dan dokumen berbeda, perbedaan itu adalah temuan yang harus diselesaikan: perbaiki salah satunya, jangan dibiarkan.

| Folder                           | Isi                                                                     |
| -------------------------------- | ----------------------------------------------------------------------- |
| [design/](design/)               | Dokumen desain sistem per fase (keputusan dan alasannya)                |
| [plans/](plans/)                 | Rencana implementasi per fase                                           |
| [architecture/](architecture/)   | Arsitektur kontainer, jaringan, alur data, dan [ADR](architecture/adr/) |
| [product/](product/)             | Aturan produk, modul, status sistem, glosarium                          |
| [design-system/](design-system/) | Token, komponen atomik, maskot Kapa & gerak, responsif                  |
| [api/](api/)                     | Kontrak endpoint Core API                                               |
| [data/](data/)                   | Kamus data, katalog, dataset seed, kontrak bundel prediksi              |
| [security/](security/)           | Model ancaman, daftar periksa ASVS, kebijakan rahasia                   |
| [operations/](operations/)       | Menjalankan lokal, troubleshooting, runbook                             |
| [testing/](testing/)             | Strategi uji, cara menjalankan, uji beban                               |
| [audits/](audits/)               | Laporan audit di akhir setiap fase                                      |

Dokumen utama:

- [Desain sistem](design/2026-11-11-kawan-pasar-design.md)
- [Rencana Fase 0 — Fondasi](plans/2026-11-11-fase-0-fondasi.md)
- [Panduan kontribusi](../CONTRIBUTING.md)

## Format ADR

`architecture/adr/NNNN-judul.md`, berisi: **Status**, **Konteks**, **Opsi** (kelebihan dan kekurangan masing-masing), **Keputusan**, **Konsekuensi**.
