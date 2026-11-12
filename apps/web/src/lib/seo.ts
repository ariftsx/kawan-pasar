import type { Metadata } from 'next';

/** Public origin used for canonical URLs and the sitemap (no secrets; available at build). */
export const SITE_URL = new URL(process.env['PUBLIC_SITE_URL'] ?? 'http://127.0.0.1:8080');

/**
 * Page metadata with a canonical URL on the public path. Data pages render under /PIKJ/…, so
 * without this both URLs would be indexable as duplicates.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    metadataBase: SITE_URL,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: 'Kawan Pasar', locale: 'id_ID' },
  };
}
