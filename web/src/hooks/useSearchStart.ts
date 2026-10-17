import { useReplaySets } from '@/hooks/api/useReplaySets';
import { useSearches } from '@/hooks/api/useSearches';
import { failed } from '@/lib/query';
import type { ReplayedStation } from '@/lib/replay';
import { ongoingIn, startRefusal } from '@/lib/search';

export function useSearchStart(at: ReplayedStation) {
  const searches = useSearches(at.teamId, at.lineId, at.stationId);
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);
  const replaySets = sets.data ?? [];
  const refusal = sets.data
    ? startRefusal(replaySets, ongoingIn(searches.data ?? []))
    : failed(sets)
      ? 'Sorry, the replay sets couldn’t be loaded. Please try again later.'
      : 'Loading the replay sets…';

  return { searches, sets, replaySets, refusal };
}
