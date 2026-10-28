import { useReplaySet } from '@/hooks/api/useReplaySet';
import { useSearches } from '@/hooks/api/useSearches';
import { failed } from '@/lib/query';
import type { ReplayedStation } from '@/lib/replay';
import { ongoingIn, startProblem } from '@/lib/search';

export function useSearchStart(at: ReplayedStation) {
  const searches = useSearches(at.teamId, at.lineId, at.stationId);
  const kept = useReplaySet(at.teamId, at.lineId, at.stationId);
  const problem =
    kept.data !== undefined
      ? startProblem(kept.data, ongoingIn(searches.data ?? []))
      : failed(kept)
        ? 'Sorry, the replay set couldn’t be loaded. Please try again later.'
        : 'Loading the replay set…';

  return { searches, kept, problem };
}
