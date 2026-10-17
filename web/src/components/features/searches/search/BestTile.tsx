import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { OnlyOnSeenTasksMark } from '@/components/features/searches/OnlyOnSeenTasksMark';
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
        note={aims}
      />
    );
  }

  const heldOut = best.heldOutScore !== null;
  const rate = heldOut ? best.heldOutScore : best.searchScore;

  return (
    <InsightsTile
      label={formatBestTerm(objective)}
      value={best.seed ? 'Live config' : best.name}
      detail={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {rate !== null && `${formatPercent(rate)} ${formatBestOn(heldOut)}`}
          {best.onlyOnSeenTasks && (
            <OnlyOnSeenTasksMark mark={best.onlyOnSeenTasks} />
          )}
        </span>
      }
      note={formatSentences(
        aims,
        formatLikely(heldOut ? best.heldOutInterval : best.searchInterval),
      )}
    />
  );
}
