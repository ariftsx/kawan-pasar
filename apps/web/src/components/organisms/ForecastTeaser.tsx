import type { ForecastResponse, PricePoint } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import { formatHorizon } from '@/lib/format';
import { hrefs } from '@/lib/hrefs';
import { forecastView, noForecastKind } from '@/lib/insights/forecast-view';
import { Button } from '../atoms/Button';
import { Disclaimer } from '../atoms/Disclaimer';
import { IconBox } from '../atoms/IconBox';
import { ForecastChart } from '../charts/ForecastChart';
import { Switch } from '../charts/Switch';
import { SystemState } from './SystemState';
import { PredictionMeta } from './PredictionMeta';

const TEASER_HORIZONS = [1, 7, 30, 90, 365] as const;

/** Home-page forecast card (v0.4 "Prediksi ARIF-Net") for one commodity. */
export function ForecastTeaser({
  forecast,
  actual,
}: {
  forecast: ForecastResponse;
  actual: readonly PricePoint[];
}): ReactNode {
  const view = forecastView(forecast);
  const id = 'beranda-prediksi';
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBox tone="terong" size={40}>
            <FeatureIcon name="prediksi" />
          </IconBox>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-heading-title-20">
              Prediksi ARIF-Net
            </h2>
            <p className="text-body-small-13 text-muted-text">
              {forecast.commodity.name} · {forecast.market.name}
            </p>
          </div>
        </div>
        {view.showNumbers ? (
          <Switch
            targetId={id}
            name="horizon"
            label="Horizon prediksi"
            defaultValue="7"
            options={TEASER_HORIZONS.map((d) => ({
              value: String(d),
              short: formatHorizon(d).short,
              long: formatHorizon(d).long,
            }))}
          />
        ) : null}
      </div>
      {view.showNumbers &&
      forecast.artifact !== null &&
      forecast.baseDate !== null &&
      forecast.basePriceIdr !== null ? (
        <>
          <ForecastChart
            id={id}
            actual={actual}
            baseDate={forecast.baseDate}
            basePriceIdr={forecast.basePriceIdr}
            horizons={forecast.horizons}
          />
          <PredictionMeta artifact={forecast.artifact} expired={forecast.status === 'expired'} />
          <Disclaimer />
          <Button
            href={hrefs.forecast(forecast.commodity.code)}
            variant="ghost"
            size="S"
            arrow
            className="self-start"
          >
            Lihat semua horizon
          </Button>
        </>
      ) : (
        <SystemState
          kind={noForecastKind(forecast.status)}
          commodityName={forecast.commodity.name.toLowerCase()}
        />
      )}
    </section>
  );
}
