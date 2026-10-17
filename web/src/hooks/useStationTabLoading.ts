import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import { useSearches } from '@/hooks/api/useSearches';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { useStationOutcomes } from '@/hooks/api/useStationOutcomes';
import { DEFAULT_PERIOD } from '@/lib/insights';
import { loading } from '@/lib/query';
import type { StationTab } from '@/lib/station';

type StationIds = {
  readonly teamId?: string;
  readonly lineId?: string;
  readonly stationId?: string;
};

export function useStationTabLoading(
  tab: StationTab | null,
  { teamId, lineId, stationId }: StationIds,
): boolean {
  const on = (shown: StationTab) => (tab === shown ? stationId : undefined);
  const outcomes = useStationOutcomes(teamId, lineId, on('overview'));
  const judge = useStationJudge(teamId, lineId, on('overview'));
  const signals = useInsightsOverview(
    tab === 'improve' ? teamId : undefined,
    DEFAULT_PERIOD,
  );
  const sets = useReplaySets(teamId, lineId, on('improve'));
  const searches = useSearches(teamId, lineId, on('improve'));

  if (tab === 'overview') {
    return [outcomes, judge].some(loading);
  }
  if (tab === 'improve') {
    return [signals, sets, searches].some(loading);
  }
  return false;
}
