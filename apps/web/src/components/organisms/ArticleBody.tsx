import type { Element, ElementContent } from 'hast';
import type { ReactNode } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';

/** Elements an article may produce. Anything else is unwrapped to plain text. */
const ALLOWED = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'code'];

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const plain = (md: string): string => md.replace(/[*_`]/g, '').trim();

/** Level-2 headings (table of contents), with the ids ArticleBody gives them. */
export function headingsOf(markdown: string): { id: string; text: string }[] {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((m) => {
    const text = plain(m[1] ?? '');
    return { id: slugify(text), text };
  });
}

function textOf(node: Element | ElementContent | undefined): string {
  if (node === undefined) return '';
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

const components: Components = {
  h2: ({ node, children }) => (
    <h2 id={slugify(textOf(node))} className="mt-8 scroll-mt-28 text-heading-title-20 first:mt-0">
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
};

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
        components={components}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
