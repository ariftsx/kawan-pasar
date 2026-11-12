import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/peringatan'] }],
    sitemap: new URL('/sitemap.xml', SITE_URL).href,
  };
}
