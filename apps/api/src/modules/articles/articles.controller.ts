import {
  ArticleSchema,
  ArticleSlugSchema,
  ArticlesQuerySchema,
  ArticlesResponseSchema,
} from '@kawan-pasar/contracts';
import type { ArticleCategory } from '@kawan-pasar/contracts';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service.js';
import { notFound } from '../../common/api-errors.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ArticlesRepository } from './articles.repository.js';

const TTL_SECONDS = 21_600;

@Controller('v1/articles')
export class ArticlesController {
  constructor(
    private readonly repo: ArticlesRepository,
    private readonly cache: CacheService,
  ) {}

  /** JSON text of ArticlesResponse (cached text is sent as-is). */
  @Get()
  @Header('content-type', 'application/json; charset=utf-8')
  list(
    @Query(new ZodValidationPipe(ArticlesQuerySchema)) query: { category?: ArticleCategory },
  ): Promise<string> {
    const category = query.category;
    return this.cache.getOrLoadJson(
      `articles:list:${category ?? 'all'}`,
      TTL_SECONDS,
      ArticlesResponseSchema,
      async () => ({ items: await this.repo.list(category) }),
    );
  }

  /** Malformed slugs, drafts and unknown slugs are all a plain 404 (input is never echoed). */
  @Get(':slug')
  @Header('content-type', 'application/json; charset=utf-8')
  async bySlug(@Param('slug') slug: string): Promise<string> {
    if (!ArticleSlugSchema.safeParse(slug).success) throw notFound();
    const article = await this.cache.getOrLoadJson(
      `articles:item:${slug}`,
      TTL_SECONDS,
      ArticleSchema.nullable(),
      () => this.repo.bySlug(slug),
    );
    // Unknown or draft slugs are cached as the JSON literal null.
    if (article === 'null') throw notFound();
    return article;
  }
}
