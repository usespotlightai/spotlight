import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { formatPercent } from '@/lib/judge';
import {
  formatRunsScored,
  minGainSentence,
  NOT_SCORED_YET,
} from '@/lib/replay-words';
import type { SearchDetail } from '@/lib/search';
import { formatLikely, formatSentences, NO_VALUE } from '@/lib/search-words';

export function LiveConfigTile({ search }: { search: SearchDetail }) {
  const { seed } = search;
  const scored = seed.searchScored > 0 && seed.searchScore !== null;

  return (
    <InsightsTile
      label="Live config"
      value={
        scored && seed.searchScore !== null
          ? formatPercent(seed.searchScore)
          : NO_VALUE
      }
      detail={scored ? formatRunsScored(seed.searchScored) : NOT_SCORED_YET}
      note={formatSentences(
        formatLikely(seed.searchInterval),
        `${minGainSentence(search.minGain)}.`,
      )}
    />
  );
}
