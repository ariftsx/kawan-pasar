import { cn } from '@kawan-pasar/ui';

// Duotone feature icons on a 24 px grid (brand v0.4). Always decorative: the visible label next
// to an icon carries the meaning.

export type FeatureIconName =
  | 'beranda'
  | 'harga'
  | 'prediksi'
  | 'inflasi'
  | 'edukasi'
  | 'arif-net'
  | 'pasar'
  | 'peringatan'
  | 'lainnya'
  | 'cari'
  | 'panah'
  | 'bawah'
  | 'info'
  | 'kalender'
  | 'cuaca'
  | 'berita'
  | 'unduh'
  | 'whatsapp'
  | 'centang';

function Paths({ name }: { readonly name: FeatureIconName }) {
  switch (name) {
    case 'beranda':
      return (
        <>
          <path
            className="fill-illustration-mint stroke-illustration-ink"
            d="M4 11 L12 4 L20 11 V20 H14.5 V14.5 H9.5 V20 H4 Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'harga':
      return (
        <>
          <path
            className="fill-illustration-kunyit-light stroke-illustration-ink"
            d="M3.5 12.2V4.8C3.5 4.1 4.1 3.5 4.8 3.5H12.2L20.5 11.8L11.8 20.5Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle className="fill-illustration-ink" cx="8.2" cy="8.2" r="1.6" />
        </>
      );
    case 'prediksi':
      return (
        <>
          <path
            className="stroke-illustration-ink"
            d="M3.5 19.5 H20.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.4"
          />
          <path
            className="stroke-illustration-ink"
            d="M4 16 L9 11 L13 13.5 L16.5 9.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            className="stroke-illustration-terong"
            d="M16.5 9.5 L20 6"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="2 2.5"
          />
          <circle className="fill-illustration-terong" cx="20" cy="5.5" r="2" />
        </>
      );
    case 'inflasi':
      return (
        <>
          <ellipse
            className="fill-illustration-kunyit-light stroke-illustration-ink"
            cx="9.5"
            cy="17"
            rx="6"
            ry="2.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse
            className="fill-illustration-kunyit-light stroke-illustration-ink"
            cx="9.5"
            cy="10.5"
            rx="6"
            ry="2.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M3.5 10.5V17 M15.5 10.5V17"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-chili"
            d="M19 12 V4 M16.5 6.5 L19 4 L21.5 6.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'edukasi':
      return (
        <>
          <path
            className="fill-illustration-mint stroke-illustration-ink"
            d="M12 6.5C10 5 7 4.5 3.5 5V18.5C7 18 10 18.5 12 20C14 18.5 17 18 20.5 18.5V5C17 4.5 14 5 12 6.5Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M12 6.5V20"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'arif-net':
      return (
        <>
          <path
            className="stroke-illustration-ink"
            d="M6 7 L12 12 L18 7 M6 17 L12 12 L18 17 M6 7 V17 M18 7 V17"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
          />
          <circle
            className="fill-illustration-white stroke-illustration-ink"
            cx="6"
            cy="7"
            r="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            className="fill-illustration-white stroke-illustration-ink"
            cx="6"
            cy="17"
            r="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            className="fill-illustration-white stroke-illustration-ink"
            cx="18"
            cy="7"
            r="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            className="fill-illustration-white stroke-illustration-ink"
            cx="18"
            cy="17"
            r="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle className="fill-illustration-terong" cx="12" cy="12" r="3" />
        </>
      );
    case 'pasar':
      return (
        <>
          <path
            className="fill-illustration-chili-light stroke-illustration-ink"
            d="M12 21C12 21 5.5 15.4 5.5 10A6.5 6.5 0 0 1 18.5 10C18.5 15.4 12 21 12 21Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="fill-illustration-chili stroke-illustration-ink"
            d="M8.5 9 H15.5 L14.8 7 H9.2 Z"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M9.5 9 V12.5 H14.5 V9"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'peringatan':
      return (
        <>
          <path
            className="fill-illustration-kunyit-light stroke-illustration-ink"
            d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M10 20.5a2 2 0 0 0 4 0"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'lainnya':
      return (
        <>
          <rect
            className="fill-illustration-mint stroke-illustration-ink"
            x="4"
            y="4"
            width="6.5"
            height="6.5"
            rx="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            className="stroke-illustration-ink"
            x="13.5"
            y="4"
            width="6.5"
            height="6.5"
            rx="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <rect
            className="stroke-illustration-ink"
            x="4"
            y="13.5"
            width="6.5"
            height="6.5"
            rx="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <rect
            className="fill-illustration-kunyit-light stroke-illustration-ink"
            x="13.5"
            y="13.5"
            width="6.5"
            height="6.5"
            rx="2"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'cari':
      return (
        <>
          <circle
            className="fill-illustration-mint stroke-illustration-ink"
            cx="11"
            cy="11"
            r="6.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M16 16 L20 20"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'panah':
      return (
        <>
          <path
            className="stroke-illustration-ink"
            d="M5 12 H19 M13 6 L19 12 L13 18"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'bawah':
      return (
        <>
          <path
            className="stroke-illustration-ink"
            d="M6 9 L12 15 L18 9"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'info':
      return (
        <>
          <circle
            className="fill-illustration-sky stroke-illustration-ink"
            cx="12"
            cy="12"
            r="8.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M12 11 V16"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle className="fill-illustration-ink" cx="12" cy="8" r="1.2" />
        </>
      );
    case 'kalender':
      return (
        <>
          <rect
            className="fill-illustration-kunyit-light stroke-illustration-ink"
            x="4"
            y="5.5"
            width="16"
            height="14.5"
            rx="3"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M4 10 H20 M8.5 3.5 V7 M15.5 3.5 V7"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'cuaca':
      return (
        <>
          <path
            className="fill-illustration-sky stroke-illustration-ink"
            d="M7.5 17 H17 A3.5 3.5 0 0 0 16.5 10 A5 5 0 0 0 7 11 A3 3 0 0 0 7.5 17Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M9 20 L8 22 M13 20 L12 22"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'berita':
      return (
        <>
          <rect
            className="fill-illustration-mint stroke-illustration-ink"
            x="4"
            y="4.5"
            width="13"
            height="15"
            rx="2.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M17 8.5 H20 V17.5 A2 2 0 0 1 16 17.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            className="stroke-illustration-ink"
            d="M7.5 9 H13.5 M7.5 12.5 H13.5 M7.5 16 H11"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'unduh':
      return (
        <>
          <path
            className="stroke-illustration-ink"
            d="M12 4 V15 M7.5 10.5 L12 15 L16.5 10.5 M5 19.5 H19"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'whatsapp':
      return (
        <>
          <path
            className="fill-illustration-mint stroke-illustration-ink"
            d="M12 3.5A8.5 8.5 0 0 0 4.6 16.2L3.5 20.5L7.9 19.4A8.5 8.5 0 1 0 12 3.5Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="fill-illustration-leaf-dark"
            d="M9 9.5C9 12 11.5 14.5 14.5 15L15.5 13.5L13.8 12.6L13 13.4C12 13 11 12 10.6 11L11.4 10.2L10.5 8.5Z"
          />
        </>
      );
    case 'centang':
      return (
        <>
          <circle
            className="fill-illustration-mint stroke-illustration-ink"
            cx="12"
            cy="12"
            r="8.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="stroke-illustration-ink"
            d="M8.5 12.3 L11 14.8 L15.8 9.5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
  }
}

export function FeatureIcon({
  name,
  className,
}: {
  readonly name: FeatureIconName;
  readonly className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-6 shrink-0', className)}>
      <Paths name={name} />
    </svg>
  );
}
