import { ButtonLink, EmptyState } from '@kawan-pasar/ui';

import { Bakul } from '@/components/mascot/bakul';

export default function NotFound() {
  return (
    <EmptyState
      illustration={<Bakul pose="think" className="w-32" />}
      title="Halaman tidak ditemukan"
      description="Alamat ini tidak ada di Kawan Pasar."
      action={<ButtonLink href="/">Ke Beranda</ButtonLink>}
    />
  );
}
