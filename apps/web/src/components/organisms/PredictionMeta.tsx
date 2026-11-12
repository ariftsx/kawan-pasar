import type { ForecastArtifact } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { formatDateWib } from '@/lib/format';
import { Chip } from '../atoms/Chip';

/**
 * Version line that must accompany every forecast number (design §3): model and version, data
 * version and cutoff, plus "Data demo" / "Kedaluwarsa" labels.
 */
export function PredictionMeta({
  artifact,
  expired = false,
  compact = false,
}: {
  artifact: ForecastArtifact;
  expired?: boolean;
  compact?: boolean;
}): ReactNode {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-text">
      {expired ? (
        <Chip tone="kunyit" size="S">
          Kedaluwarsa
        </Chip>
      ) : null}
      {artifact.isDemo ? (
        <Chip tone="kunyit-solid" size="S">
          Data demo
        </Chip>
      ) : null}
      <span>
        Model {artifact.modelName}{' '}
        <span className="font-mono break-all">{artifact.modelVersion}</span>
        {compact ? null : (
          <>
            {' '}
            · data <span className="font-mono break-all">{artifact.dataVersion}</span> s.d.{' '}
            {formatDateWib(artifact.dataCutoff, 'short')}
          </>
        )}
      </span>
    </p>
  );
}
