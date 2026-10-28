import type { UseQueryResult } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StateBox } from '@/components/features/replays/StateBox';
import { SearchRow } from '@/components/features/searches/set/SearchRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  newestFirst,
  SEARCH_HEADINGS,
  SEARCHES_ANCHOR,
  SEARCHES_NOTE,
  type Search,
  searchNumber,
} from '@/lib/search';
import { formatSkip, NO_SEARCHES_YET } from '@/lib/search-words';

type SetSearchesProps = {
  at: ReplayedStation;
  set: ReplaySet;
  searches: UseQueryResult<Search[]>;
};

export function SetSearches({ at, set, searches }: SetSearchesProps) {
  const listed = (searches.data ?? []).filter(
    (search) => search.setId === set.id,
  );
  const schedule = set.searchSchedule;

  let body: ReactNode;

  if (loading(searches)) {
    body = (
      <NestedTableSkeleton
        label="Loading the searches"
        headings={SEARCH_HEADINGS}
        compact
      />
    );
  } else if (failed(searches)) {
    body = (
      <StateBox flat>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only team members can see its searches"
          what="The station’s searches"
          query={searches}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox flat>
        <EmptyState icon={Sparkles} title="No searches yet">
          {schedule
            ? formatSkip(schedule.lastSkip, schedule.minimumTasks)
            : NO_SEARCHES_YET}
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <NestedTable label="Searches" headings={SEARCH_HEADINGS} compact>
        {newestFirst(listed).map((search) => (
          <SearchRow
            key={search.id}
            at={at}
            search={search}
            number={searchNumber(listed, search.id)}
          />
        ))}
      </NestedTable>
    );
  }

  return (
    <InsightsCard
      id={SEARCHES_ANCHOR}
      tableOnly
      title="Searches"
      description={SEARCHES_NOTE}
    >
      {body}
    </InsightsCard>
  );
}
