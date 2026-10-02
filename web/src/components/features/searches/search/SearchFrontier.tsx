import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { FrontierChart } from '@/components/features/searches/search/FrontierChart';
import { FrontierTable } from '@/components/features/searches/search/FrontierTable';
import { stateShown } from '@/lib/replay-words';
import {
  candidateName,
  candidatesOf,
  frontierPoints,
  type SearchDetail,
  scoreShown,
} from '@/lib/search';

type SearchFrontierProps = {
  search: SearchDetail;
};

export function SearchFrontier({ search }: SearchFrontierProps) {
  const currency = search.budget.ceiling.currency;
  const { priced, unpriced, unfinished } = frontierPoints(search);

  return (
    <InsightsCard
      title="Success against cost"
      description="How often each candidate succeeded on the searched tasks, against what it spent a run. The frontier joins those no other succeeds as often for less; the live config is always on it."
      table={
        <FrontierTable candidates={candidatesOf(search)} currency={currency} />
      }
    >
      {priced.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No candidate has a priced score yet. Show the table for what there is.
        </p>
      ) : (
        <FrontierChart points={priced} currency={currency} />
      )}

      {unpriced.length > 0 && (
        <p data-slot="unpriced" className="text-muted-foreground text-xs">
          Not priced, so not shown:{' '}
          {unpriced
            .map(
              (each) =>
                `${candidateName(each)} (${scoreShown(each.searchScore)})`,
            )
            .join(', ')}
          .
        </p>
      )}

      {unfinished.length > 0 && (
        <p data-slot="unfinished" className="text-muted-foreground text-xs">
          Still replaying or stopped early, so not shown:{' '}
          {unfinished
            .map(
              (each) =>
                `${candidateName(each)} (${
                  each.replayState
                    ? stateShown(each.replayState).toLowerCase()
                    : 'gone'
                })`,
            )
            .join(', ')}
          .
        </p>
      )}
    </InsightsCard>
  );
}
