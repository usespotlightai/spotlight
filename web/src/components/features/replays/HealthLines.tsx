import type { ReactNode } from 'react';
import { HealthLine } from '@/components/features/replays/HealthLine';
import {
  type HealthKey,
  healthListLabelShown,
  healthReadingsOf,
  type SetHealth,
} from '@/lib/replay-words';

type HealthLinesProps = {
  setName: string;
  health: SetHealth;
  minGain: number;
  replayTo?: (replayId: string) => string;
  details?: Partial<Record<HealthKey, ReactNode>>;
};

export function HealthLines({
  setName,
  health,
  minGain,
  replayTo,
  details = {},
}: HealthLinesProps) {
  return (
    <ul
      aria-label={healthListLabelShown(setName)}
      data-slot="health-lines"
      className="flex flex-col"
    >
      {healthReadingsOf(health, minGain).map((reading) => {
        const replayId = health[reading.key]?.replayId;

        return (
          <HealthLine
            key={reading.key}
            reading={reading}
            replayTo={replayId && replayTo ? replayTo(replayId) : null}
          >
            {details[reading.key]}
          </HealthLine>
        );
      })}
    </ul>
  );
}
