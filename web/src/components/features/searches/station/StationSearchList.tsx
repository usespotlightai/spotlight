import type { UseQueryResult } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { StateBox } from '@/components/features/replays/StateBox';
import { SearchRow } from '@/components/features/searches/station/SearchRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  newestFirst,
  SEARCH_HEADINGS,
  type Search,
  searchNumber,
} from '@/lib/search';
import { formatSkip, NO_SEARCHES_YET } from '@/lib/search-words';

type StationSearchListProps = {
  at: ReplayedStation;
  searches: UseQueryResult<Search[]>;
  set: UseQueryResult<ReplaySet | null>;
};

export function StationSearchList({
  at,
  searches,
  set,
}: StationSearchListProps) {
  const listed = searches.data ?? [];

  if (loading(searches) || loading(set)) {
    return (
      <NestedTableSkeleton
        label="Loading the searches"
        headings={SEARCH_HEADINGS}
        compact
      />
    );
  }

  if (failed(searches)) {
    return (
      <StateBox flat>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only team members can see its searches"
          what="The station’s searches"
          query={searches}
        />
      </StateBox>
    );
  }

  if (listed.length === 0) {
    return (
      <StateBox flat>
        <EmptyState icon={Sparkles} title="No searches yet">
          {set.data?.searchSchedule
            ? formatSkip(set.data.searchSchedule)
            : NO_SEARCHES_YET}
        </EmptyState>
      </StateBox>
    );
  }

  return (
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
