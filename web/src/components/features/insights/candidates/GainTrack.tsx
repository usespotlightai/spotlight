import { useContext } from 'react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { GainScale } from '@/lib/insights-candidates';
import type { GainEstimate } from '@/lib/replay';
import {
  formatGain,
  formatGainSignificance,
  type GainSignificanceCode,
  gainSignificanceNote,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const INKS: Record<GainSignificanceCode, string> = {
  better: 'var(--chart-primary)',
  worse: 'var(--outcome-failed)',
  'within-noise':
    'color-mix(in oklab, var(--muted-foreground) 70%, transparent)',
};

const at = (value: number, extent: number): string =>
  `${50 + (Math.max(-extent, Math.min(extent, value)) / extent) * 50}%`;

export function GainTrack({ gain }: { gain: GainEstimate | null }) {
  const extent = useContext(GainScale);

  if (!gain) {
    return <span className="text-muted-foreground">Not compared</span>;
  }

  const ink = INKS[gain.significance];
  const noise = gain.significance === 'within-noise';

  return (
    <WithTooltip tooltip={gainSignificanceNote(gain)}>
      <span
        data-slot="gain-track"
        data-significance={gain.significance}
        className="flex min-w-0 cursor-default items-center gap-3"
      >
        <span aria-hidden className="relative h-4 min-w-16 flex-1">
          <span
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
            style={{ background: 'var(--chart-grid)' }}
          />
          <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/35" />
          <span
            className="absolute inset-y-0.5 w-0 border-foreground/25 border-l border-dashed"
            style={{ left: at(gain.minGain, extent) }}
          />
          <span
            className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full opacity-40 dark:opacity-90"
            style={{
              left: at(gain.low, extent),
              right: `calc(100% - ${at(gain.high, extent)})`,
              background: ink,
            }}
          />
          <span
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: at(gain.gain, extent), background: ink }}
          />
        </span>
        <span className="sr-only">
          {formatGainSignificance(gain.significance)}
        </span>
        <span
          className={cn(
            'w-14 shrink-0 text-right tabular-nums',
            noise ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {formatGain(gain)}
        </span>
      </span>
    </WithTooltip>
  );
}
