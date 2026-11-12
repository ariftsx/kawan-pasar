import { z } from 'zod';
import { IsoDateTime } from './common.js';

export const ArticleCategorySchema = z.enum(['dasar', 'prediksi', 'arif-net', 'keterbatasan']);
export type ArticleCategory = z.infer<typeof ArticleCategorySchema>;

export const ArticleSlugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const ArticleListItemSchema = z.strictObject({
  slug: ArticleSlugSchema,
  category: ArticleCategorySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  readingMinutes: z.int().positive(),
  publishedAt: IsoDateTime,
});
export type ArticleListItem = z.infer<typeof ArticleListItemSchema>;

export const ArticleSchema = z.strictObject({
  ...ArticleListItemSchema.shape,
  bodyMd: z.string().min(1).max(100_000),
  updatedAt: IsoDateTime,
});
export type Article = z.infer<typeof ArticleSchema>;

export const ArticlesResponseSchema = z.strictObject({ items: z.array(ArticleListItemSchema) });
export type ArticlesResponse = z.infer<typeof ArticlesResponseSchema>;

export const ArticlesQuerySchema = z.strictObject({ category: ArticleCategorySchema.optional() });
export const ArticleParamsSchema = z.strictObject({ slug: ArticleSlugSchema });
