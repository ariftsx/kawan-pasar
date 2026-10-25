import { ButtonLink, EmptyState } from '@kawan-pasar/ui';

export default function NotFound() {
  return (
    <EmptyState
      title="Halaman tidak ditemukan"
      description="Alamat ini tidak ada di Kawan Pasar."
      action={<ButtonLink href="/">Ke Beranda</ButtonLink>}
    />
  );
}
