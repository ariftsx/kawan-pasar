import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ForecastPage } from '@/components/templates/ForecastPage';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { hrefs } from '@/lib/hrefs';
import { commodityFrom, marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string; commodity: string }[] {
  return [];
}

type Params = Promise<{ market: string; commodity: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = commodityFrom((await params).commodity);
  return pageMetadata({
    title: `Prediksi ${c.name.toLowerCase()}`,
    description: `Perkiraan harga ${c.name.toLowerCase()} 1 hari sampai 1 tahun ke depan.`,
    path: hrefs.forecast(c.code),
  });
}

export default async function PrediksiKomoditas({
  params,
}: {
  params: Params;
}): Promise<ReactNode> {
  const market = await marketFrom(params);
  const commodity = commodityFrom((await params).commodity);
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
