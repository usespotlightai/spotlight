import type { ReactNode } from 'react';
import { HealthLine } from '@/components/features/replays/HealthLine';
import {
  type HealthKey,
  healthListLabelShown,
  healthReadingsOf,
  type SetHealth,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type HealthLinesProps = {
  setName: string;
  health: SetHealth;
  minGain: number;
  compact?: boolean;
  replayTo?: (replayId: string) => string;
  details?: Partial<Record<HealthKey, ReactNode>>;
};

export function HealthLines({
  setName,
  health,
  minGain,
  compact = false,
  replayTo,
  details = {},
}: HealthLinesProps) {
  return (
    <ul
      aria-label={healthListLabelShown(setName)}
      data-slot="health-lines"
      className={cn(
        'flex',
        compact ? 'flex-wrap gap-x-3 gap-y-0.5' : 'flex-col',
      )}
    >
      {healthReadingsOf(health, minGain).map((reading) => {
        const replayId = health[reading.key]?.replayId;

        return (
          <HealthLine
            key={reading.key}
            reading={reading}
            compact={compact}
            replayTo={replayId && replayTo ? replayTo(replayId) : null}
          >
            {details[reading.key]}
          </HealthLine>
        );
      })}
    </ul>
  );
}
