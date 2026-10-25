# @kawan-pasar/catalog

Katalog produk berversi (`CATALOG_VERSION`) untuk F1 (keputusan F1-Q1): bahan, jenis warung, dan template menu. Data ini dipakai web langsung. Di F2, data yang sama di-_seed_ ke Postgres oleh api, lalu web membaca `/v1/menu-templates`.

- **Bahan.** Hanya 3 komoditas model yang `supported` dan punya perkiraan: cabai merah keriting, bawang merah, dan beras medium (D-19). Bahan lain berstatus `coming_soon` ("Harga sedang disiapkan", DH-01).
- **Template.** 3 jenis warung × 3 menu (F1-Q2): Warteg, Masakan Padang, Ayam Geprek/Penyet. Takaran per porsi adalah contoh dan masih perlu divalidasi PO dari hasil wawancara.
- **Harga.** `demo_price_idr` adalah **DATA DEMO** untuk mode `demo` saja (F1-Q4). Harga ini bukan observasi pasar, dan UI wajib memberinya label DATA DEMO. Harga contoh 3 komoditas sama dengan kartu demo di `apps/web`, sehingga Ayam Geprek tetap Rp 10.850 per porsi (docs 05 §4).

Data divalidasi dengan skema zod saat modul dimuat. Slug, satuan, jenis warung, atau bahan yang tidak dikenal langsung menggagalkan build dan test.
