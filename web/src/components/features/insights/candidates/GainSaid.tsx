import { Noted } from '@/components/shared/Noted';
import type { GainReading } from '@/lib/replay';
import {
  type GainVerdictCode,
  gainShown,
  gainVerdictNote,
  gainVerdictShown,
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

  return (
    <Noted note={gainVerdictNote(gain)}>
      <span
        data-slot="gain-said"
        data-verdict={gain.verdict}
        className="inline-flex items-baseline gap-1.5 whitespace-nowrap"
      >
        <span className="font-medium text-foreground">{gainShown(gain)}</span>
        <span className={cn(TONES[gain.verdict])}>
          {gainVerdictShown(gain.verdict)}
        </span>
      </span>
    </Noted>
  );
}
