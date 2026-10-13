import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { percentShown } from '@/lib/judge';
import {
  minGainSentence,
  NOT_SCORED_YET,
  runsScoredShown,
} from '@/lib/replay-words';
import type { SearchDetail } from '@/lib/search';
import { likelyShown, NO_VALUE, sentencesShown } from '@/lib/search-words';

export function LiveConfigTile({ search }: { search: SearchDetail }) {
  const { seed } = search;
  const scored = seed.searchScored > 0 && seed.searchScore !== null;

  return (
    <InsightsTile
      label="Live config"
      value={
        scored && seed.searchScore !== null
          ? percentShown(seed.searchScore)
          : NO_VALUE
      }
      detail={scored ? runsScoredShown(seed.searchScored) : NOT_SCORED_YET}
      note={sentencesShown(
        likelyShown(seed.searchInterval),
        `${minGainSentence(search.minGain)}.`,
      )}
    />
  );
}
