import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { BestTile } from '@/components/features/searches/search/BestTile';
import { LiveConfigTile } from '@/components/features/searches/search/LiveConfigTile';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { spendShown } from '@/lib/insights';
import type { ReplaySet } from '@/lib/replay';
import { repeatsShown } from '@/lib/replay-words';
import { type SearchDetail, setTaskTitle } from '@/lib/search';
import {
  budgetNoteShown,
  heldOutTasksShown,
  SPLIT_NOTE,
  sentencesShown,
} from '@/lib/search-words';

type SearchTilesProps = {
  search: SearchDetail;
  set: ReplaySet | undefined;
};

export function SearchTiles({ search, set }: SearchTilesProps) {
  const { data: harnesses } = useHarnesses();
  const { budget, agent, split } = search;
  const harness =
    harnesses?.find((each) => each.id === agent.harness)?.name ?? agent.harness;

  return (
    <InsightsTiles label="The search in numbers" className="gap-3">
      <BestTile search={search} />
      <LiveConfigTile search={search} />

      <InsightsTile
        label="Iterations"
        value={`${search.iterationsRun} of ${budget.iterations}`}
        detail={`${search.proposed} ${search.proposed === 1 ? 'candidate' : 'candidates'} proposed`}
        note={budgetNoteShown(
          budget,
          repeatsShown(budget.repeats),
          [harness, agent.model, agent.effort].filter(Boolean).join(' · '),
        )}
      />

      <InsightsTile
        label="Tasks"
        value={`${split.searchedTasks}`}
        detail={`searched · ${split.heldOutTasks} held out`}
        note={sentencesShown(
          SPLIT_NOTE,
          heldOutTasksShown(
            split.heldOut.map((entry) => setTaskTitle(entry, set)),
          ),
        )}
      />

      <InsightsTile
        label="Spent"
        value={spendShown(search.spent)}
        detail={`of ${spendShown(budget.ceiling)}`}
      />
    </InsightsTiles>
  );
}
