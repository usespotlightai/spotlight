import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplayCheckThreshold } from '@/components/features/replays/ReplayCheckThreshold';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { LineSource } from '@/components/features/searches/station/LineSource';
import { SearchRow } from '@/components/features/searches/station/SearchRow';
import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { StationSection } from '@/components/features/stations/StationSection';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { buttonVariants } from '@/components/ui/button';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import { useSearches } from '@/hooks/api/useSearches';
import type { LineSourceResponseDto } from '@/lib/api';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { REPLAYS_ANCHOR, type ReplayedStation } from '@/lib/replay';
import {
  type LineReplayCheck,
  newestFirst,
  ongoingIn,
  SEARCHES_ANCHOR,
  searchNumber,
  startRefusal,
} from '@/lib/search';
import { cn } from '@/lib/utils';

type StationSearchesProps = {
  at: ReplayedStation;
  source: LineSourceResponseDto | null;
  replayCheck: LineReplayCheck | null;
};

export function StationSearches({
  at,
  source,
  replayCheck,
}: StationSearchesProps) {
  const searches = useSearches(at.teamId, at.lineId, at.stationId);
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);
  const listed = searches.data ?? [];
  const held = sets.data ?? [];
  const refusal = sets.data
    ? startRefusal(held, ongoingIn(listed))
    : failed(sets)
      ? 'The replay sets could not be loaded.'
      : 'Loading the replay sets…';
  const start = (
    <StartSearchButton at={at} sets={held} refusedBecause={refusal} />
  );
  const shown = !loading(searches) && !failed(searches) && listed.length > 0;

  let body: ReactNode;

  if (loading(searches)) {
    body = <RowsSkeleton label="Loading the searches" />;
  } else if (failed(searches)) {
    body = (
      <StateBox>
        {notFound(searches.error) ? (
          <MembersOnly title="Only the team’s members can see its searches" />
        ) : (
          <CouldNotLoad
            what="The station’s searches"
            retrying={searches.isFetching}
            onRetry={() => void searches.refetch()}
          />
        )}
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox>
        <EmptyState
          icon={Sparkles}
          title="No searches yet"
          action={
            sets.data && held.length === 0 ? (
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
          A search has an agent propose better configs for this station, and
          replays each on a replay set to find which do better for less.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <CardList label="Searches">
        {newestFirst(listed).map((search) => (
          <SearchRow
            key={search.id}
            at={at}
            search={search}
            number={searchNumber(listed, search.id)}
            setName={held.find((set) => set.id === search.setId)?.name ?? null}
          />
        ))}
      </CardList>
    );
  }

  return (
    <StationSection title="Searches" id={SEARCHES_ANCHOR}>
      <ReplaysHeading
        title="Searches of this station"
        action={shown ? start : undefined}
      />
      {body}
      <LineSource source={source} />
      <ReplayCheckThreshold replayCheck={replayCheck} />
    </StationSection>
  );
}
