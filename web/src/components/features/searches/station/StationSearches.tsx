import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { StationSearchList } from '@/components/features/searches/station/StationSearchList';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import { useSearches } from '@/hooks/api/useSearches';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation } from '@/lib/replay';
import { ongoingIn, startRefusal } from '@/lib/search';

type StationSearchesProps = {
  at: ReplayedStation;
};

export function StationSearches({ at }: StationSearchesProps) {
  const searches = useSearches(at.teamId, at.lineId, at.stationId);
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);
  const listed = searches.data ?? [];
  const held = sets.data ?? [];
  const refusal = sets.data
    ? startRefusal(held, ongoingIn(listed))
    : failed(sets)
      ? 'Sorry, the replay sets couldn’t be loaded. Please try again later.'
      : 'Loading the replay sets…';
  const start = (
    <StartSearchButton at={at} sets={held} refusedBecause={refusal} />
  );
  const shown = !loading(searches) && !failed(searches) && listed.length > 0;

  return (
    <>
      <StationSearchList
        at={at}
        searches={searches}
        sets={sets.data}
        start={start}
      />
      {shown && <div>{start}</div>}
    </>
  );
}
