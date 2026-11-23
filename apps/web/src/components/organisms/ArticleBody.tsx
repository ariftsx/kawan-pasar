import type { Element, ElementContent } from 'hast';
import type { ReactNode } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import { IMAGE_ORIGINS } from '@/lib/image-origins';

/** Elements an article may produce. Anything else is unwrapped to plain text. */
const ALLOWED = [
  'h2',
  'h3',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'blockquote',
  'code',
  // Fase 3B (K2): only from the allowed origins, see `img` below.
  'img',
];

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Heading text as the renderer shows it: link text kept, link targets and emphasis dropped. */
const plain = (md: string): string =>
  md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim();

/** Ids in document order; a repeated heading gets -2, -3, … (same rule for body and contents). */
function uniqueIds(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugify(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${String(n)}`;
  };
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Level-2 headings (table of contents), with the ids ArticleBody gives them. */
export function headingsOf(markdown: string): { id: string; text: string }[] {
  const nextId = uniqueIds();
  const out: { id: string; text: string }[] = [];
  let fence: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const marker = FENCE.exec(line)?.[1];
    if (marker !== undefined) {
      const kind = marker.slice(0, 3);
      if (fence === null) fence = kind;
      else if (fence === kind) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = /^ {0,3}## (.+)$/.exec(line);
    if (m === null) continue;
    const text = plain(m[1] ?? '');
    out.push({ id: nextId(text), text });
  }
  return out;
}

function textOf(node: Element | ElementContent | undefined): string {
  if (node === undefined) return '';
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

function safeImage(src: string): string | null {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' && IMAGE_ORIGINS.includes(u.origin) ? u.href : null;
  } catch {
    return null;
  }
}

const components = (nextId: (text: string) => string): Components => ({
  h2: ({ node, children }) => (
    <h2 id={nextId(textOf(node))} className="mt-8 scroll-mt-28 text-heading-title-20 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 text-heading-card-16">{children}</h3>,
  p: ({ children }) => <p className="mt-3 text-body-medium-15 text-ink-2">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-6 text-ink-2">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-ink-2">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-kunyit-500 bg-kunyit-100 px-4 py-2">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-2 px-1 font-mono text-[0.9em]">{children}</code>
  ),
  img: ({ src, alt }) => {
    // Only https images from ARTICLE_IMAGE_ORIGINS (also the CSP img-src). Anything else keeps
    // its description as text and is never requested, so no tracker can be embedded.
    const url = typeof src === 'string' ? safeImage(src) : null;
    if (url === null) return alt === undefined || alt === '' ? null : <>{alt}</>;
    return (
      // Plain <img> on purpose: next/image would make our server fetch third-party images (and
      // need remotePatterns); the browser loads them directly, limited by CSP img-src.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="mt-4 h-auto w-full rounded-lg"
      />
    );
  },
  a: ({ href, children }) => {
    // urlTransform already emptied unsafe targets (javascript:, data:, …): render plain text.
    if (href === undefined || href === '') return <>{children}</>;
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="font-semibold text-green-900 underline underline-offset-2"
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
        {external ? <span className="sr-only"> (membuka tab baru)</span> : null}
      </a>
    );
  },
});

/**
 * Article Markdown rendered on the server (no client JavaScript). Raw HTML is skipped, only the
 * elements in ALLOWED are produced (others are unwrapped to text), and link targets go through
 * react-markdown's safe URL transform (http(s), mailto and relative URLs only).
 */
export function ArticleBody({ markdown }: { markdown: string }): ReactNode {
  return (
    <div className="article-body">
      <Markdown
        skipHtml
        allowedElements={ALLOWED}
        unwrapDisallowed
        urlTransform={defaultUrlTransform}
        components={components(uniqueIds())}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
