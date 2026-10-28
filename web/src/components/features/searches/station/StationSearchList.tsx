import type { UseQueryResult } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateBox } from '@/components/features/replays/StateBox';
import { SearchRow } from '@/components/features/searches/station/SearchRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  NO_REPLAY_SET_YET,
  newestFirst,
  SEARCH_HEADINGS,
  type Search,
  searchNumber,
} from '@/lib/search';

type StationSearchListProps = {
  at: ReplayedStation;
  searches: UseQueryResult<Search[]>;
  set: ReplaySet | null | undefined;
  start: ReactNode;
};

export function StationSearchList({
  at,
  searches,
  set,
  start,
}: StationSearchListProps) {
  const listed = searches.data ?? [];

  if (loading(searches)) {
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
        <EmptyState icon={Sparkles} title="No searches yet" action={start}>
          {set === null
            ? NO_REPLAY_SET_YET
            : 'An agent tries configs on a replay set to find a better, cheaper one.'}
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
