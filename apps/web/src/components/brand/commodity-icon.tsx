import { cn } from '@kawan-pasar/ui';

import type { CommoditySlug } from '@kawan-pasar/catalog';

// Commodity icons on a 48 px grid, drawn for the five commodities Kawan Pasar watches.

function Paths({ slug }: { readonly slug: CommoditySlug }) {
  switch (slug) {
    case 'cabai-merah-keriting':
      return (
        <>
          <path
            className="stroke-illustration-leaf-dark"
            d="M14 10 C13 7 14 5 17 4"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-chili"
            d="M14 12 C20 11 22 18 23 24 C24.5 32 30 36 38 37 C33 41 23 40 18.5 33 C14 26 12 18 14 12 Z"
          />
          <path
            className="stroke-illustration-white"
            d="M17 17 C18 22 19 27 22 31"
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-leaf-dark"
            d="M10.5 12.5 C12 9.5 16.5 9 18 12 C15.5 14 12.5 14 10.5 12.5Z"
          />
        </>
      );
    case 'cabai-rawit-hijau':
      return (
        <>
          <path
            className="stroke-illustration-leaf-dark"
            d="M16 9 C15.5 6.5 16.5 4.5 19 3.5"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-leaf"
            d="M16 11 C19 12 21 19 23 26 C25 33 28 37 33 40 C27 41 21 37 19 30 C17 23 15 16 16 11Z"
          />
          <path
            className="stroke-illustration-white"
            d="M18 16 C19 21 20 26 22 30"
            strokeOpacity="0.45"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-leaf-dark"
            d="M13.5 11.2 C15 8.8 18.5 8.8 19.5 11.2 C17.5 12.6 15 12.6 13.5 11.2Z"
          />
        </>
      );
    case 'cabai-rawit-merah':
      return (
        <>
          <path
            className="stroke-illustration-leaf-dark"
            d="M16 9 C15.5 6.5 16.5 4.5 19 3.5"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-chili"
            d="M16 11 C19 12 21 19 23 26 C25 33 28 37 33 40 C27 41 21 37 19 30 C17 23 15 16 16 11Z"
          />
          <path
            className="stroke-illustration-white"
            d="M18 16 C19 21 20 26 22 30"
            strokeOpacity="0.45"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-leaf-dark"
            d="M13.5 11.2 C15 8.8 18.5 8.8 19.5 11.2 C17.5 12.6 15 12.6 13.5 11.2Z"
          />
        </>
      );
    case 'bawang-merah':
      return (
        <>
          <path
            className="stroke-illustration-shallot-dark"
            d="M24 11 C24 7 23 5 20.5 3.5 M24 11 C25 7 27 5 29.5 4.5"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="fill-illustration-shallot"
            d="M24 9 C27 16 37 19 37 28 C37 35 31 40 24 40 C17 40 11 35 11 28 C11 19 21 16 24 9Z"
          />
          <path
            className="stroke-illustration-cheek"
            d="M24 14 C20 20 18 30 20 39 M24 14 C28 20 30 30 28 39"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            className="stroke-illustration-white"
            d="M15 26 C15.5 22 17.5 19.5 20 18"
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            className="stroke-illustration-sand"
            d="M20 40 L19 43 M24 40 V43.5 M28 40 L29 43"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      );
    case 'beras-medium-1':
      return (
        <>
          <path
            className="fill-illustration-white stroke-illustration-line"
            d="M9 25 C10 14 38 14 39 25Z"
            strokeWidth="1.5"
          />
          <ellipse
            className="fill-illustration-line"
            cx="18"
            cy="20"
            rx="1.4"
            ry="2.4"
            transform="rotate(-30 18 20)"
          />
          <ellipse className="fill-illustration-line" cx="25" cy="18" rx="1.4" ry="2.4" />
          <ellipse
            className="fill-illustration-line"
            cx="31"
            cy="21"
            rx="1.4"
            ry="2.4"
            transform="rotate(30 31 21)"
          />
          <path
            className="fill-illustration-brand"
            d="M6 25 H42 C42 34 34 41 24 41 C14 41 6 34 6 25Z"
          />
          <path
            className="stroke-illustration-kunyit"
            d="M10 29 H38"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
  }
}

export function CommodityIcon({
  slug,
  className,
}: {
  readonly slug: CommoditySlug;
  readonly className?: string;
}) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('size-8 shrink-0', className)}>
      <Paths slug={slug} />
    </svg>
  );
}
