import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { PairTally } from '@/components/features/replays/PairTally';
import type { GainReading } from '@/lib/replay';
import { pairsJudged, type PairTally as Tally } from '@/lib/replay-words';

type GainWithPairsProps = {
  gain: GainReading | null;
  pairs: Tally | null;
  against: string;
};

export function GainWithPairs({ gain, pairs, against }: GainWithPairsProps) {
  if (!gain && !pairsJudged(pairs)) {
    return '–';
  }

  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      {gain && <GainVerdict gain={gain} />}
      {gain && pairsJudged(pairs) && (
        <span aria-hidden className="text-muted-foreground text-xs">
          ·
        </span>
      )}
      <PairTally tally={pairs} against={against} />
    </span>
  );
}
