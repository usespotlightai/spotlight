import { Minus, Triangle } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import type { GainEstimate } from '@/lib/replay';
import {
  formatGain,
  formatGainSignificance,
  type GainSignificanceCode,
  gainSignificanceNote,
} from '@/lib/replay-words';
import type { TooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

const TONES: Record<GainSignificanceCode, string> = {
  better: 'text-emerald-700 dark:text-emerald-400',
  worse: 'text-destructive',
  'within-noise': 'text-muted-foreground',
};

type GainValueProps = {
  gain: GainEstimate | null;
  tooltip?: TooltipText;
};

export function GainValue({ gain, tooltip }: GainValueProps) {
  if (!gain) {
    return <span className="text-muted-foreground">Not compared</span>;
  }

  const points = Math.round(gain.gain * 100);
  const noise = gain.significance === 'within-noise';
  const icon = cn('size-2.5 shrink-0', TONES[gain.significance]);

  return (
    <WithTooltip tooltip={tooltip ?? gainSignificanceNote(gain)}>
      <span
        data-slot="gain-value"
        data-significance={gain.significance}
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
        <span className="sr-only">
          {formatGainSignificance(gain.significance)}
        </span>
        <span
          className={cn(
            'font-medium',
            noise ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {formatGain(gain)}
        </span>
      </span>
    </WithTooltip>
  );
}
