# Data bawaan API

## `breached-passwords.txt.gz`

Daftar kata sandi yang pernah bocor, dipakai untuk menolak kata sandi baru (desain Fase 2 §3, OWASP ASVS 2.1.7).

- **Sumber:** SecLists (`Passwords/Common-Credentials/Pwdb_top-1000000.txt` dan `100k-most-used-passwords-NCSC.txt`), lisensi MIT (`SECLISTS-LICENSE`).
- **Saringan:** hanya entri sepanjang 12–128 karakter. Entri yang lebih pendek sudah ditolak oleh aturan panjang minimum.
- **Isi:** 31.658 entri unik, satu per baris, gzip. Pembandingan tanpa membedakan huruf besar dan kecil.
- **Membuat ulang:**

  ```bash
  cat Pwdb_top-1000000.txt 100k-most-used-passwords-NCSC.txt | tr -d '\r' \
    | awk 'length($0) >= 12 && length($0) <= 128' | sort -u | gzip -9 > breached-passwords.txt.gz
  ```
