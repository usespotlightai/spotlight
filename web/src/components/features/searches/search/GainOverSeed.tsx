import { GainWithPairs } from '@/components/features/replays/GainWithPairs';
import type { GainEstimate } from '@/lib/replay';
import { type PairTally, THE_SEARCH_START } from '@/lib/replay-words';

type GainOverSeedProps = {
  label: string;
  gain: GainEstimate | null;
  pairs: PairTally | null;
};

export function GainOverSeed({ label, gain, pairs }: GainOverSeedProps) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd>
        <GainWithPairs gain={gain} pairs={pairs} against={THE_SEARCH_START} />
      </dd>
    </div>
  );
}
