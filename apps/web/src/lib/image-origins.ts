import { parseImageOrigins } from '@kawan-pasar/contracts';

/**
 * Article image origins (Fase 3B, K2) from ARTICLE_IMAGE_ORIGINS, same parser as the API. Read
 * once: the static pages' CSP is built from it at build time (next.config), the account and
 * admin pages' CSP per request (proxy), and the article renderer allows images only from it.
 * An invalid value throws, so a misconfiguration fails the build instead of hiding images.
 */
export const IMAGE_ORIGINS: readonly string[] = parseImageOrigins(
  process.env['ARTICLE_IMAGE_ORIGINS'],
);
