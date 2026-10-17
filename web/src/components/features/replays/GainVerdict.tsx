import type { ReactNode } from 'react';
import { Noted } from '@/components/shared/Noted';
import type { GainReading } from '@/lib/replay';
import {
  formatGain,
  formatGainRange,
  formatGainVerdict,
  type GainVerdictCode,
  gainVerdictNote,
  VERSUS,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const TONES: Record<GainVerdictCode, string> = {
  better: 'text-emerald-600 dark:text-emerald-400',
  worse: 'text-destructive',
  'within-noise': 'text-muted-foreground',
};

type GainVerdictProps = {
  gain: GainReading;
  against?: ReactNode;
  className?: string;
};

export function GainVerdict({
  gain,
  against = null,
  className,
}: GainVerdictProps) {
  return (
    <span
      data-slot="gain-verdict"
      data-verdict={gain.verdict}
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
      <Noted note={gainVerdictNote(gain)}>
        <span
          data-slot="gain-verdict-word"
          className={cn('font-medium', TONES[gain.verdict])}
        >
          · {formatGainVerdict(gain.verdict)}
        </span>
      </Noted>
    </span>
  );
}
