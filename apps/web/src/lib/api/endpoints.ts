import 'server-only';
import type { CommodityCode, MarketCode } from '@kawan-pasar/catalog';
import {
  cacheTags as tagsFor,
  ArticleSchema,
  ArticlesResponseSchema,
  ForecastResponseSchema,
  HistoryResponseSchema,
  MarketsResponseSchema,
  PriceSummaryResponseSchema,
} from '@kawan-pasar/contracts';
import type {
  Article,
  ArticleCategory,
  ArticlesResponse,
  ForecastResponse,
  HistoryRange,
  HistoryResponse,
  MarketsResponse,
  PriceSummaryResponse,
} from '@kawan-pasar/contracts';
import type { ApiResult } from './client';
import { apiGet } from './client';

/** Fallback revalidation (seconds). Tag revalidation from the API normally comes first. */
export const REVALIDATE = { prices: 600, articles: 21_600, markets: 86_400 } as const;

/** The only place that knows Core API paths. */
export const api = {
  markets: (): Promise<ApiResult<MarketsResponse>> =>
    apiGet('/v1/markets', MarketsResponseSchema, {
      tags: [tagsFor.markets],
      revalidate: REVALIDATE.markets,
    }),

  priceSummary: (m: MarketCode): Promise<ApiResult<PriceSummaryResponse>> =>
    apiGet(`/v1/markets/${m}/prices`, PriceSummaryResponseSchema, {
      tags: [tagsFor.prices(m), tagsFor.forecast(m)],
      revalidate: REVALIDATE.prices,
    }),

  history: (
    m: MarketCode,
    c: CommodityCode,
    range: HistoryRange,
  ): Promise<ApiResult<HistoryResponse>> =>
    apiGet(`/v1/markets/${m}/commodities/${c}/history?range=${range}`, HistoryResponseSchema, {
      tags: [tagsFor.history(m, c), tagsFor.prices(m)],
      revalidate: REVALIDATE.prices,
    }),

  forecast: (m: MarketCode, c: CommodityCode): Promise<ApiResult<ForecastResponse>> =>
    apiGet(`/v1/markets/${m}/commodities/${c}/forecast`, ForecastResponseSchema, {
      tags: [tagsFor.forecast(m)],
      revalidate: REVALIDATE.prices,
    }),

  articles: (category?: ArticleCategory): Promise<ApiResult<ArticlesResponse>> =>
    apiGet(
      category === undefined ? '/v1/articles' : `/v1/articles?category=${category}`,
      ArticlesResponseSchema,
      { tags: [tagsFor.articles], revalidate: REVALIDATE.articles },
    ),

  article: (slug: string): Promise<ApiResult<Article>> =>
    apiGet(`/v1/articles/${encodeURIComponent(slug)}`, ArticleSchema, {
      tags: [tagsFor.articles, tagsFor.article(slug)],
      revalidate: REVALIDATE.articles,
    }),
};
