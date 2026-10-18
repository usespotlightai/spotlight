import type { ReactNode } from 'react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import type { GainEstimate } from '@/lib/replay';
import {
  formatGain,
  formatGainRange,
  formatGainSignificance,
  type GainSignificanceCode,
  gainSignificanceNote,
  VERSUS,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const TONES: Record<GainSignificanceCode, string> = {
  better: 'text-emerald-600 dark:text-emerald-400',
  worse: 'text-destructive',
  'within-noise': 'text-muted-foreground',
};

type GainSignificanceProps = {
  gain: GainEstimate;
  against?: ReactNode;
  className?: string;
};

export function GainSignificance({
  gain,
  against = null,
  className,
}: GainSignificanceProps) {
  return (
    <span
      data-slot="gain-significance"
      data-significance={gain.significance}
      className={cn(
        'inline-flex min-w-0 flex-wrap items-baseline gap-x-1 text-xs tabular-nums',
        className,
      )}
    >
      <span className="text-foreground">{formatGain(gain)}</span>
      <span className="text-muted-foreground">({formatGainRange(gain)})</span>
      {against && (
        <span className="text-muted-foreground">
          {VERSUS} {against}
        </span>
      )}
      <WithTooltip tooltip={gainSignificanceNote(gain)}>
        <span
          data-slot="gain-significance-word"
          className={cn('font-medium', TONES[gain.significance])}
        >
          · {formatGainSignificance(gain.significance)}
        </span>
      </WithTooltip>
    </span>
  );
}
