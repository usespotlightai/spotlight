import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { OnlyOnSeenTasksMark } from '@/components/features/searches/OnlyOnSeenTasksMark';
import { percentShown } from '@/lib/judge';
import type { SearchDetail } from '@/lib/search';
import {
  bestOnShown,
  bestTermShown,
  likelyShown,
  NO_VALUE,
  noBestShown,
  objectiveNote,
  objectiveShown,
  sentencesShown,
} from '@/lib/search-words';

export function BestTile({ search }: { search: SearchDetail }) {
  const { best, objective } = search;
  const aims = `Aims for ${objectiveShown(objective).toLowerCase()}. ${objectiveNote(objective)}`;

  if (!best) {
    return (
      <InsightsTile
        label={bestTermShown(objective)}
        value={NO_VALUE}
        detail={noBestShown(objective)}
        note={aims}
      />
    );
  }

  const heldOut = best.heldOutScore !== null;
  const rate = heldOut ? best.heldOutScore : best.searchScore;

  return (
    <InsightsTile
      label={bestTermShown(objective)}
      value={best.seed ? 'Live config' : best.name}
      detail={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {rate !== null && `${percentShown(rate)} ${bestOnShown(heldOut)}`}
          {best.onlyOnSeenTasks && (
            <OnlyOnSeenTasksMark mark={best.onlyOnSeenTasks} />
          )}
        </span>
      }
      note={sentencesShown(
        aims,
        likelyShown(heldOut ? best.heldOutInterval : best.searchInterval),
      )}
    />
  );
}
