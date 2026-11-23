import type { Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';

export { DEFAULT_IMAGE_ORIGINS, parseImageOrigins } from './image-origins.js';

// Checks on article Markdown written in the admin editor (Fase 3B). Parsed with the same
// CommonMark parser the public renderer uses (react-markdown → mdast-util-from-markdown), so a
// link the renderer would see is a link checked here, whatever form it is written in.
// Own subpath (`@kawan-pasar/contracts/article-body`): the parser never reaches browser bundles.

/** Design § 1 (P4): 50 KB of UTF-8 per article. */
export const ARTICLE_MAX_BYTES = 50_000;

export type ArticleBodyProblem = 'size' | 'link' | 'image_origin' | 'image_alt' | 'html';
const ORDER: readonly ArticleBodyProblem[] = ['size', 'link', 'image_origin', 'image_alt', 'html'];

/** https, an internal path (not `//host`), or a fragment on the same page. */
function safeLink(url: string): boolean {
  if (url.startsWith('#')) return true;
  if (url.startsWith('/')) return !url.startsWith('//') && !url.startsWith('/\\');
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Exact origin match (scheme + host + port), so `upload.wikimedia.org.evil.example` fails. */
function allowedImage(url: string, origins: readonly string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && origins.includes(u.origin);
  } catch {
    return false;
  }
}

function walk(node: Nodes, visit: (n: Nodes) => void): void {
  visit(node);
  if ('children' in node) for (const child of node.children) walk(child, visit);
}

/** Problems with an article body, each once, in a fixed order; empty when it may be saved. */
export function articleBodyProblems(
  markdown: string,
  imageOrigins: readonly string[],
): ArticleBodyProblem[] {
  if (new TextEncoder().encode(markdown).length > ARTICLE_MAX_BYTES) return ['size'];
  const tree = fromMarkdown(markdown);
  // Reference-style links and images point at a definition: check where they really go.
  const definitions = new Map<string, string>();
  walk(tree, (n) => {
    // The FIRST definition of an identifier wins (CommonMark; mdast-util-to-hast does the same).
    // Keeping the last would let `[x]: //evil` hide behind a later `[x]: https://ok` (Fase 3B review).
    if (n.type === 'definition' && !definitions.has(n.identifier)) {
      definitions.set(n.identifier, n.url);
    }
  });
  const found = new Set<ArticleBodyProblem>();
  // Only these node types can reach the reader as a link, an image or raw HTML; the rest is text.
  walk(tree, (n) => {
    if (n.type === 'link') {
      if (!safeLink(n.url)) found.add('link');
    } else if (n.type === 'linkReference') {
      const url = definitions.get(n.identifier);
      if (url !== undefined && !safeLink(url)) found.add('link');
    } else if (n.type === 'image' || n.type === 'imageReference') {
      const url = n.type === 'image' ? n.url : definitions.get(n.identifier);
      if (url === undefined || !allowedImage(url, imageOrigins)) found.add('image_origin');
      if ((n.alt ?? '').trim() === '') found.add('image_alt');
    } else if (n.type === 'html') {
      found.add('html');
    }
  });
  // A definition that nothing uses is never rendered; a used one was checked above.
  return ORDER.filter((p) => found.has(p));
}

/** Reading time shown on the article (200 words a minute, at least 1 minute). */
export function readingMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter((w) => w !== '').length;
  return Math.max(1, Math.ceil(words / 200));
}
