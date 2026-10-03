import { GainOverSeed } from '@/components/features/searches/search/GainOverSeed';
import { gainJudged } from '@/lib/gain';
import type { SearchCandidate } from '@/lib/search';
import { GAIN_ON_HELD_OUT, GAIN_ON_SEARCHED } from '@/lib/search-words';

type CandidateGainsProps = {
  candidate: SearchCandidate;
};

export function CandidateGains({ candidate }: CandidateGainsProps) {
  const searched = gainJudged(candidate.searchedGain, candidate.searchedPairs);
  const heldOut = gainJudged(candidate.heldOutGain, candidate.heldOutPairs);

  if (!searched && !heldOut) {
    return null;
  }

  return (
    <dl
      data-slot="gain-over-seed"
      className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs"
    >
      {searched && (
        <GainOverSeed
          label={GAIN_ON_SEARCHED}
          gain={candidate.searchedGain}
          pairs={candidate.searchedPairs}
        />
      )}
      {heldOut && (
        <GainOverSeed
          label={GAIN_ON_HELD_OUT}
          gain={candidate.heldOutGain}
          pairs={candidate.heldOutPairs}
        />
      )}
    </dl>
  );
}
