import {
  AdminArticleCreateSchema,
  AdminArticleRestoreSchema,
  AdminArticleUpdateSchema,
  ArticleSlugSchema,
  maskEmail,
} from '@kawan-pasar/contracts';
import type {
  AdminArticleCreate,
  AdminArticleListResponse,
  AdminArticleResponse,
  AdminArticleRestore,
  AdminArticleSaved,
  AdminArticleUpdate,
} from '@kawan-pasar/contracts';
import { articleBodyProblems, readingMinutes } from '@kawan-pasar/contracts/article-body';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { badRequest, conflict, notFound } from '../../common/api-errors.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CacheService } from '../../cache/cache.service.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { AuthContext } from '../auth/auth.service.js';
import { Auth, CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import { WebRevalidator, tagsForScope } from '../internal/web-revalidator.js';
import type {
  AdminArticlesRepository,
  ArticleContent,
  SaveResult,
} from './admin-articles.repository.js';
import { AdminGuard, RequiresConfirmation } from './admin.guard.js';

export const ADMIN_ARTICLES = Symbol('ADMIN_ARTICLES');
const NO_STORE = 'private, no-store';

/** A slug from the path: anything else is simply not found (the input is never echoed). */
const slugOf = (raw: string): string => {
  const parsed = ArticleSlugSchema.safeParse(raw);
  if (!parsed.success) throw notFound();
  return parsed.data;
};

/** Article editor of the admin pages (Fase 3B task 6). Reading is open to admins; changes need a confirmation. */
@Controller('v1/admin/articles')
@UseGuards(SessionGuard, CsrfGuard, AdminGuard)
export class AdminArticlesController {
  constructor(
    @Inject(ADMIN_ARTICLES) private readonly repo: AdminArticlesRepository,
    @Inject(ENV) private readonly env: Env,
    @Inject(CacheService) private readonly cache: CacheService,
    @Inject(WebRevalidator) private readonly web: WebRevalidator,
  ) {}

  @Get()
  @Header('cache-control', NO_STORE)
  async list(): Promise<AdminArticleListResponse> {
    const rows = await this.repo.list();
    return {
      items: rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        category: r.category,
        status: r.publishedAt === null ? 'draft' : 'published',
        revision: r.revision,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  @Get(':slug')
  @Header('cache-control', NO_STORE)
  async get(@Param('slug') raw: string): Promise<AdminArticleResponse> {
    const a = await this.repo.get(slugOf(raw));
    if (a === null) throw notFound();
    return {
      slug: a.slug,
      category: a.category,
      title: a.title,
      summary: a.summary,
      bodyMd: a.bodyMd,
      readingMinutes: a.readingMinutes,
      revision: a.revision,
      published: a.publishedAt !== null,
      publishedAt: a.publishedAt === null ? null : a.publishedAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      revisions: a.revisions.map((r) => ({
        revision: r.revision,
        createdAt: r.createdAt.toISOString(),
        by: r.email === null ? null : maskEmail(r.email),
      })),
    };
  }

  @Post()
  @HttpCode(201)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AdminArticleCreateSchema)) body: AdminArticleCreate,
  ): Promise<AdminArticleSaved> {
    return this.saved(await this.repo.create(body.slug, this.content(body), auth.session.userId));
  }

  @Put(':slug')
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async update(
    @Auth() auth: AuthContext,
    @Param('slug') raw: string,
    @Body(new ZodValidationPipe(AdminArticleUpdateSchema)) body: AdminArticleUpdate,
  ): Promise<AdminArticleSaved> {
    const slug = slugOf(raw);
    const result = await this.repo.update(
      slug,
      this.content(body),
      body.baseRevision,
      auth.session.userId,
    );
    // A published article changes on the public pages too.
    if (result.ok) await this.refreshPublic();
    return this.saved(result);
  }

  @Post(':slug/restore')
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async restore(
    @Auth() auth: AuthContext,
    @Param('slug') raw: string,
    @Body(new ZodValidationPipe(AdminArticleRestoreSchema)) body: AdminArticleRestore,
  ): Promise<AdminArticleSaved> {
    const result = await this.repo.restore(
      slugOf(raw),
      body.revision,
      body.baseRevision,
      auth.session.userId,
      (bodyMd) => articleBodyProblems(bodyMd, this.env.ARTICLE_IMAGE_ORIGINS),
    );
    if (result.ok) await this.refreshPublic();
    return this.saved(result);
  }

  @Post(':slug/publish')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async publish(@Auth() auth: AuthContext, @Param('slug') raw: string): Promise<void> {
    if (!(await this.repo.setPublished(slugOf(raw), true, auth.session.userId))) throw notFound();
    await this.refreshPublic();
  }

  @Post(':slug/unpublish')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async unpublish(@Auth() auth: AuthContext, @Param('slug') raw: string): Promise<void> {
    if (!(await this.repo.setPublished(slugOf(raw), false, auth.session.userId))) throw notFound();
    await this.refreshPublic();
  }

  /** Field checks passed (zod); now the body itself, with the renderer's Markdown parser. */
  private content(input: {
    category: ArticleContent['category'];
    title: string;
    summary: string;
    bodyMd: string;
  }): ArticleContent {
    const problems = articleBodyProblems(input.bodyMd, this.env.ARTICLE_IMAGE_ORIGINS);
    if (problems.length > 0) throw badRequest(problems);
    return {
      category: input.category,
      title: input.title,
      summary: input.summary,
      bodyMd: input.bodyMd,
      readingMinutes: readingMinutes(input.bodyMd),
    };
  }

  private saved(result: SaveResult): AdminArticleSaved {
    if (result.ok) return { revision: result.revision };
    if (result.why === 'invalid') throw badRequest(result.problems);
    if (result.why === 'not_found' || result.why === 'no_revision') throw notFound();
    throw conflict(result.why);
  }

  /** API cache first, then the web pages (best effort, like after an import). */
  private async refreshPublic(): Promise<void> {
    await this.cache.invalidate('articles');
    await this.web.revalidate(tagsForScope('articles'));
  }
}
