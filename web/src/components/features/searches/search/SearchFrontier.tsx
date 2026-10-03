import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import { FrontierChart } from '@/components/features/searches/search/FrontierChart';
import { FrontierTable } from '@/components/features/searches/search/FrontierTable';
import { stateShown } from '@/lib/replay-words';
import {
  candidateName,
  candidatesOf,
  frontierPoints,
  type SearchDetail,
} from '@/lib/search';
import { frontierNote, onlyOnSeenTasksCountShown } from '@/lib/search-words';

type SearchFrontierProps = {
  search: SearchDetail;
};

export function SearchFrontier({ search }: SearchFrontierProps) {
  const currency = search.budget.ceiling.currency;
  const { priced, unpriced, unfinished } = frontierPoints(search);

  return (
    <InsightsCard
      title="Success against cost"
      description={frontierNote(search.objective)}
      table={
        <FrontierTable candidates={candidatesOf(search)} currency={currency} />
      }
    >
      {search.onlyOnSeenTasks > 0 && (
        <p
          data-slot="only-on-seen-tasks-count"
          role="note"
          className="text-amber-700 text-xs leading-5 dark:text-amber-300"
        >
          {onlyOnSeenTasksCountShown(search.onlyOnSeenTasks)}
        </p>
      )}

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
          {unpriced.map((each, place) => (
            <span key={each.candidateId}>
              {place > 0 && ', '}
              {candidateName(each)} (
              <RateWithInterval
                rate={each.searchScore}
                interval={each.searchInterval}
                className="text-muted-foreground"
              />
              )
            </span>
          ))}
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
