import { Minus, Triangle } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';
import type { GainReading } from '@/lib/replay';
import {
  formatGain,
  formatGainVerdict,
  type GainVerdictCode,
  gainVerdictNote,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const TONES: Record<GainVerdictCode, string> = {
  better: 'text-emerald-700 dark:text-emerald-400',
  worse: 'text-destructive',
  'within-noise': 'text-muted-foreground',
};

export function GainSaid({ gain }: { gain: GainReading | null }) {
  if (!gain) {
    return <span className="text-muted-foreground">Not compared</span>;
  }

  const points = Math.round(gain.gain * 100);
  const noise = gain.verdict === 'within-noise';
  const icon = cn('size-2.5 shrink-0', TONES[gain.verdict]);

  return (
    <Noted note={gainVerdictNote(gain)}>
      <span
        data-slot="gain-said"
        data-verdict={gain.verdict}
        className="inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        {points === 0 ? (
          <Minus aria-hidden className={icon} />
        ) : (
          <Triangle
            aria-hidden
            className={cn(icon, 'fill-current', points < 0 && 'rotate-180')}
          />
        )}
        <span className="sr-only">{formatGainVerdict(gain.verdict)}</span>
        <span
          className={cn(
            'font-medium',
            noise ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {formatGain(gain)}
        </span>
      </span>
    </Noted>
  );
}
