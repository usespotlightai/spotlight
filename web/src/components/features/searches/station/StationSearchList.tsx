import type { UseQueryResult } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { SearchRow } from '@/components/features/searches/station/SearchRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { buttonVariants } from '@/components/ui/button-variants';
import { failed, loading } from '@/lib/query';
import {
  REPLAYS_ANCHOR,
  type ReplayedStation,
  type ReplaySet,
} from '@/lib/replay';
import { newestFirst, type Search, searchNumber } from '@/lib/search';
import { cn } from '@/lib/utils';

type StationSearchListProps = {
  at: ReplayedStation;
  searches: UseQueryResult<Search[]>;
  sets: readonly ReplaySet[] | undefined;
  start: ReactNode;
};

export function StationSearchList({
  at,
  searches,
  sets,
  start,
}: StationSearchListProps) {
  const listed = searches.data ?? [];

  if (loading(searches)) {
    return <RowsSkeleton label="Loading the searches" />;
  }

  if (failed(searches)) {
    return (
      <StateBox>
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
      <StateBox>
        <EmptyState
          icon={Sparkles}
          title="No searches yet"
          action={
            sets?.length === 0 ? (
              <a
                href={`#${REPLAYS_ANCHOR}`}
                className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
              >
                Open a replay set first
              </a>
            ) : (
              start
            )
          }
        >
          A search has an agent propose configs for this station. Each is
          replayed on a replay set to find which do better for less.
        </EmptyState>
      </StateBox>
    );
  }

  return (
    <CardList label="Searches">
      {newestFirst(listed).map((search) => (
        <SearchRow
          key={search.id}
          at={at}
          search={search}
          number={searchNumber(listed, search.id)}
          setName={sets?.find((set) => set.id === search.setId)?.name ?? null}
        />
      ))}
    </CardList>
  );
}
