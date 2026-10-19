import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { CandidateIcons } from '@/components/features/searches/CandidateIcons';
import { formatPercent } from '@/lib/judge';
import type { SearchDetail } from '@/lib/search';
import {
  formatBestOn,
  formatBestTerm,
  formatLikely,
  formatNoBest,
  formatObjective,
  formatSentences,
  NO_VALUE,
  objectiveNote,
} from '@/lib/search-words';

export function BestTile({ search }: { search: SearchDetail }) {
  const { best, objective } = search;
  const aims = `The search aims for ${formatObjective(objective).toLowerCase()}. ${objectiveNote(objective)}`;

  if (!best) {
    return (
      <InsightsTile
        label={formatBestTerm(objective)}
        value={NO_VALUE}
        detail={formatNoBest(objective)}
        tooltip={aims}
      />
    );
  }

  const heldOut = best.heldOutScore !== null;
  const rate = heldOut ? best.heldOutScore : best.searchScore;

  return (
    <InsightsTile
      label={formatBestTerm(objective)}
      value={best.isSeed ? 'Live config' : best.name}
      detail={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {rate !== null && `${formatPercent(rate)} ${formatBestOn(heldOut)}`}
          <CandidateIcons
            candidate={best}
            maxRegressions={search.maxRegressions}
          />
        </span>
      }
      tooltip={formatSentences(
        aims,
        formatLikely(heldOut ? best.heldOutInterval : best.searchInterval),
      )}
    />
  );
}
