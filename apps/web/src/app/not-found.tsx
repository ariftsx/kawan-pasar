import { ButtonLink, EmptyState } from '@kawan-pasar/ui';

import { Kapa } from '@/components/brand/kapa';

export default function NotFound() {
  return (
    <EmptyState
      illustration={<Kapa pose="belajar" className="w-32" />}
      title="Halaman tidak ditemukan"
      description="Alamat ini tidak ada di Kawan Pasar."
      action={<ButtonLink href="/">Ke Beranda</ButtonLink>}
    />
  );
}
