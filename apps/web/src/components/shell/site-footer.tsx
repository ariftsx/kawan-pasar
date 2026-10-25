import { CATALOG_VERSION } from '@kawan-pasar/catalog';

/** Footer (docs 10 §7.5): disclaimer and versions; it never claims more than the data supports. */
export function SiteFooter({ isDemo }: { readonly isDemo: boolean }) {
  return (
    <footer className="mt-12 border-t border-border-default bg-bg-subtle pb-24 lg:pb-0">
      <div className="mx-auto flex max-w-content flex-col gap-2 px-4 py-6 text-xs text-text-muted lg:px-12">
        <p>
          Kawan Pasar membantu menghitung modal bahan. Harga dan perkiraan adalah informasi, bukan
          saran membeli, menjual, atau mengubah menu.
        </p>
        <p>
          Harga acuan: PIHPS · Pasar Kramatjati. Bukan real-time; tanggal observasi selalu
          ditampilkan.
          {isDemo ? ' Mode demo: angka berlabel DATA DEMO adalah contoh.' : ''}
        </p>
        <p className="font-mono">{CATALOG_VERSION} · perkiraan: ARIF-Net (dalam pengembangan)</p>
      </div>
    </footer>
  );
}
