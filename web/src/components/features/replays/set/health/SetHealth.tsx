import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { FlakyChecks } from '@/components/features/replays/set/health/FlakyChecks';
import { HealthRow } from '@/components/features/replays/set/health/HealthRow';
import { NoiseDetails } from '@/components/features/replays/set/health/NoiseDetails';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  SET_HEALTH_HEADINGS,
} from '@/lib/replay';
import {
  formatHealthListLabel,
  HEALTH_LABEL,
  HEALTH_NOTE,
  type HealthKey,
  healthReadingsOf,
  healthReplayOf,
} from '@/lib/replay-words';

type SetHealthProps = {
  at: ReplayedStation;
  set: ReplaySet;
};

export function SetHealth({ at, set }: SetHealthProps) {
  const { health } = set;
  const details: Partial<Record<HealthKey, ReactNode>> = {
    noise: health.noise && <NoiseDetails set={set} noise={health.noise} />,
    checks: health.checks && (
      <FlakyChecks
        slug={at.slug}
        teamId={at.teamId}
        set={set}
        checks={health.checks}
      />
    ),
  };

  return (
    <InsightsCard tableOnly title={HEALTH_LABEL} description={HEALTH_NOTE}>
      <NestedTable
        label={formatHealthListLabel(set.name)}
        headings={SET_HEALTH_HEADINGS}
        compact
      >
        {healthReadingsOf(health, set.minGain).map((reading) => {
          const replayId = healthReplayOf(health, reading.key);

          return (
            <HealthRow
              key={reading.key}
              reading={reading}
              replayTo={replayId ? replayPath(at, replayId) : null}
            >
              {details[reading.key]}
            </HealthRow>
          );
        })}
      </NestedTable>
    </InsightsCard>
  );
}
