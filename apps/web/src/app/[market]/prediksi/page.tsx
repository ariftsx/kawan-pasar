import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ForecastPage } from '@/components/templates/ForecastPage';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { FEATURED_COMMODITY, commodityFrom, marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string }[] {
  return [];
}

export const metadata: Metadata = pageMetadata({
  title: 'Prediksi harga',
  description: 'Perkiraan harga komoditas pangan 1 hari sampai 1 tahun ke depan.',
  path: '/prediksi',
});

/** `/prediksi` shows the featured (first covered) commodity. */
export default async function Prediksi({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<ReactNode> {
  const market = await marketFrom(params);
  const commodity = commodityFrom(FEATURED_COMMODITY);
  const [forecast, history] = await Promise.all([
    api.forecast(market, commodity.code),
    api.history(market, commodity.code, '90d'),
  ]);
  return (
    <ForecastPage
      commodity={commodity}
      forecast={requireData(forecast)}
      actual={requireData(history).points}
    />
  );
}
