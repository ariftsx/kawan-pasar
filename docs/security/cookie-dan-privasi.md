# Cookie dan Privasi (halaman publik)

Halaman publik Kawan Pasar tidak memakai akun, analitik, atau pelacak pihak ketiga. Hanya ada satu cookie.

| Cookie         | Nilai | Umur  | Atribut                                   | Tujuan                                                                    |
| -------------- | ----- | ----- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `kp_onboarded` | `1`   | 1 thn | `Path=/; SameSite=Lax` (+ `Secure` https) | Mengarahkan pengunjung yang pernah melewati orientasi langsung ke Beranda |

- Dipasang di browser oleh `MarkOnboarded` (`apps/web/src/components/organisms/MarkOnboarded.tsx`) saat pengunjung membuka halaman selain `/`.
- Dibaca hanya oleh `apps/web/src/proxy.ts` untuk alamat `/`.
- Tidak berisi atau terhubung ke identitas apa pun, tidak dikirim ke API, dan tidak disimpan di server. Cookie ini murni fungsional, jadi tidak memerlukan persetujuan sebagai data pribadi (UU PDP No. 27/2022). Menghapusnya hanya membuat halaman orientasi tampil lagi.
- Halaman tetap statis dan dapat di-cache. Pengalihan terjadi di proxy, bukan di halaman.

Cookie sesi akun (Fase 2) akan didokumentasikan terpisah: `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`.
