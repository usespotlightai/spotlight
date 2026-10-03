import { ReplayCheckThreshold } from '@/components/features/replays/ReplayCheckThreshold';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { LineSource } from '@/components/features/searches/station/LineSource';
import { StartSearchButton } from '@/components/features/searches/station/StartSearchButton';
import { StationSearchList } from '@/components/features/searches/station/StationSearchList';
import { StationSection } from '@/components/features/stations/StationSection';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import { useSearches } from '@/hooks/api/useSearches';
import type { LineSourceResponseDto } from '@/lib/api';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation } from '@/lib/replay';
import {
  type LineReplayCheck,
  ongoingIn,
  SEARCHES_ANCHOR,
  startRefusal,
} from '@/lib/search';

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

  return (
    <StationSection title="Searches" id={SEARCHES_ANCHOR}>
      <ReplaysHeading
        title="Searches of this station"
        action={shown ? start : undefined}
      />
      <StationSearchList
        at={at}
        searches={searches}
        sets={sets.data}
        start={start}
      />
      <LineSource source={source} />
      <ReplayCheckThreshold replayCheck={replayCheck} />
    </StationSection>
  );
}
