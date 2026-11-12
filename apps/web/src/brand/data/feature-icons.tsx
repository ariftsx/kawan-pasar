// Generated from the v0.4 prototype (ICON_FITUR, 24×24 duotone). Artwork colours are part of the illustration
// and intentionally stay as literal values here; UI components use design tokens.
import type { ReactNode } from 'react';

export const FEATURE_ICON_NAMES = [
  'beranda',
  'harga',
  'prediksi',
  'inflasi',
  'edukasi',
  'arif-net',
  'pasar',
  'peringatan',
  'lainnya',
  'cari',
  'panah',
  'bawah',
  'info',
  'kalender',
  'cuaca',
  'berita',
  'unduh',
  'whatsapp',
  'centang',
] as const;
export type FeatureIconName = (typeof FEATURE_ICON_NAMES)[number];

export const FEATURE_ICONS: Record<FeatureIconName, ReactNode> = {
  beranda: (
    <>
      <path
        d="M4 11 L12 4 L20 11 V20 H14.5 V14.5 H9.5 V20 H4 Z"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  harga: (
    <>
      <path
        d="M3.5 12.2V4.8C3.5 4.1 4.1 3.5 4.8 3.5H12.2L20.5 11.8L11.8 20.5Z"
        fill="#FDF1D8"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.2" cy="8.2" r="1.6" fill="#14201A" />
    </>
  ),
  prediksi: (
    <>
      <path
        d="M3.5 19.5 H20.5"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path
        d="M4 16 L9 11 L13 13.5 L16.5 9.5"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M16.5 9.5 L20 6"
        stroke="#6A4BD6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2 2.5"
      />
      <circle cx="20" cy="5.5" r="2" fill="#6A4BD6" />
    </>
  ),
  inflasi: (
    <>
      <ellipse
        cx="9.5"
        cy="17"
        rx="6"
        ry="2.5"
        fill="#FDF1D8"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="9.5"
        cy="10.5"
        rx="6"
        ry="2.5"
        fill="#FDF1D8"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 10.5V17 M15.5 10.5V17"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 12 V4 M16.5 6.5 L19 4 L21.5 6.5"
        stroke="#E04535"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  edukasi: (
    <>
      <path
        d="M12 6.5C10 5 7 4.5 3.5 5V18.5C7 18 10 18.5 12 20C14 18.5 17 18 20.5 18.5V5C17 4.5 14 5 12 6.5Z"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.5V20"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'arif-net': (
    <>
      <path
        d="M6 7 L12 12 L18 7 M6 17 L12 12 L18 17 M6 7 V17 M18 7 V17"
        stroke="#14201A"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle
        cx="6"
        cy="7"
        r="2"
        fill="#fff"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="6"
        cy="17"
        r="2"
        fill="#fff"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="18"
        cy="7"
        r="2"
        fill="#fff"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="18"
        cy="17"
        r="2"
        fill="#fff"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="#6A4BD6" />
    </>
  ),
  pasar: (
    <>
      <path
        d="M12 21C12 21 5.5 15.4 5.5 10A6.5 6.5 0 0 1 18.5 10C18.5 15.4 12 21 12 21Z"
        fill="#FDE7E3"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 9 H15.5 L14.8 7 H9.2 Z"
        fill="#E04535"
        stroke="#14201A"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 9 V12.5 H14.5 V9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  peringatan: (
    <>
      <path
        d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"
        fill="#FDF1D8"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20.5a2 2 0 0 0 4 0"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  lainnya: (
    <>
      <rect
        x="4"
        y="4"
        width="6.5"
        height="6.5"
        rx="2"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="13.5"
        y="4"
        width="6.5"
        height="6.5"
        rx="2"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x="4"
        y="13.5"
        width="6.5"
        height="6.5"
        rx="2"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x="13.5"
        y="13.5"
        width="6.5"
        height="6.5"
        rx="2"
        fill="#FDF1D8"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  cari: (
    <>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 16 L20 20"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  panah: (
    <>
      <path
        d="M5 12 H19 M13 6 L19 12 L13 18"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  bawah: (
    <>
      <path
        d="M6 9 L12 15 L18 9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  info: (
    <>
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="#E8F0FC"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11 V16"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="8" r="1.2" fill="#14201A" />
    </>
  ),
  kalender: (
    <>
      <rect
        x="4"
        y="5.5"
        width="16"
        height="14.5"
        rx="3"
        fill="#FDF1D8"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 10 H20 M8.5 3.5 V7 M15.5 3.5 V7"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  cuaca: (
    <>
      <path
        d="M7.5 17 H17 A3.5 3.5 0 0 0 16.5 10 A5 5 0 0 0 7 11 A3 3 0 0 0 7.5 17Z"
        fill="#E8F0FC"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20 L8 22 M13 20 L12 22"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  berita: (
    <>
      <rect
        x="4"
        y="4.5"
        width="13"
        height="15"
        rx="2.5"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 8.5 H20 V17.5 A2 2 0 0 1 16 17.5"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7.5 9 H13.5 M7.5 12.5 H13.5 M7.5 16 H11"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  unduh: (
    <>
      <path
        d="M12 4 V15 M7.5 10.5 L12 15 L16.5 10.5 M5 19.5 H19"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  whatsapp: (
    <>
      <path
        d="M12 3.5A8.5 8.5 0 0 0 4.6 16.2L3.5 20.5L7.9 19.4A8.5 8.5 0 1 0 12 3.5Z"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9.5C9 12 11.5 14.5 14.5 15L15.5 13.5L13.8 12.6L13 13.4C12 13 11 12 10.6 11L11.4 10.2L10.5 8.5Z"
        fill="#17865A"
      />
    </>
  ),
  centang: (
    <>
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="#E3F2E9"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.3 L11 14.8 L15.8 9.5"
        stroke="#14201A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
};
