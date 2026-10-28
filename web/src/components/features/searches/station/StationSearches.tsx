import { StationSearchList } from '@/components/features/searches/station/StationSearchList';
import { useReplaySet } from '@/hooks/api/useReplaySet';
import { useSearches } from '@/hooks/api/useSearches';
import type { ReplayedStation } from '@/lib/replay';

export function StationSearches({ at }: { at: ReplayedStation }) {
  const searches = useSearches(at.teamId, at.lineId, at.stationId);
  const kept = useReplaySet(at.teamId, at.lineId, at.stationId);

  return <StationSearchList at={at} searches={searches} set={kept} />;
}
