import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { BestTile } from '@/components/features/searches/search/BestTile';
import { LiveConfigTile } from '@/components/features/searches/search/LiveConfigTile';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { formatSpend } from '@/lib/insights';
import type { ReplaySet } from '@/lib/replay';
import { type SearchDetail, setTaskTitle } from '@/lib/search';
import {
  formatBudgetNote,
  formatEffort,
  formatSplitNote,
} from '@/lib/search-words';

type SearchTilesProps = {
  search: SearchDetail;
  set: ReplaySet | undefined;
};

export function SearchTiles({ search, set }: SearchTilesProps) {
  const { data: harnesses } = useHarnesses();
  const { budget, agent, split } = search;
  const harness = harnesses?.find((each) => each.id === agent.harness);
  const model =
    agent.model &&
    (harness?.models.find((each) => each.id === agent.model)?.name ??
      agent.model);

  return (
    <InsightsTiles label="The search in numbers" stacked className="gap-3">
      <BestTile search={search} />
      <LiveConfigTile search={search} />

      <InsightsTile
        label="Iterations"
        value={`${search.iterationsRun} of ${budget.iterations}`}
        detail={`${search.proposed} ${search.proposed === 1 ? 'candidate' : 'candidates'} proposed`}
        tooltip={formatBudgetNote(
          budget,
          [
            harness?.name ?? agent.harness,
            model,
            agent.effort && formatEffort(agent.effort),
          ]
            .filter(Boolean)
            .join(' · '),
        )}
      />

      <InsightsTile
        label="Tasks"
        value={`${split.searchedTasks}`}
        detail={`searched · ${split.heldOutTasks} held out`}
        tooltip={formatSplitNote(
          split.heldOut.map((entry) => setTaskTitle(entry, set)),
        )}
      />

      <InsightsTile
        label="Spent"
        value={formatSpend(search.spent)}
        detail={`of ${formatSpend(budget.ceiling)}`}
      />
    </InsightsTiles>
  );
}
