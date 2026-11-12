import { ArticleCategorySchema, ArticleSlugSchema } from '@kawan-pasar/contracts';
import { z } from 'zod';

const FrontMatterSchema = z.strictObject({
  slug: ArticleSlugSchema,
  category: ArticleCategorySchema,
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(500),
  readingMinutes: z.coerce.number().int().min(1).max(60),
  status: z.enum(['published', 'draft']),
  order: z.coerce.number().int().min(0).max(1000),
});

export type ArticleFile = z.infer<typeof FrontMatterSchema> & { readonly bodyMd: string };

/**
 * Parses `content/articles/*.md`: a `---` front-matter block of single-line `key: value` pairs,
 * then the Markdown body. Dependency-free on purpose; errors name the file and the fields.
 */
export function parseArticleFile(text: string, fileName: string): ArticleFile {
  const normalised = text.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalised);
  if (match === null) throw new Error(`${fileName}: missing front matter block`);
  const [, head = '', body = ''] = match;

  const fields: Record<string, string> = {};
  for (const line of head.split('\n')) {
    if (line.trim() === '') continue;
    const at = line.indexOf(':');
    if (at <= 0) throw new Error(`${fileName}: malformed front matter line`);
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }

  const parsed = FrontMatterSchema.safeParse(fields);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '_'))];
    throw new Error(`${fileName}: invalid front matter (${names.join(', ')})`);
  }
  if (body.trim() === '') throw new Error(`${fileName}: empty body`);
  return { ...parsed.data, bodyMd: body.trim() };
}
