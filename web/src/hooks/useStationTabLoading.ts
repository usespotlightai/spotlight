import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { useStationJudge } from '@/hooks/api/useStationJudge';
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
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const judge = useStationJudge(
    teamId,
    lineId,
    tab === 'config' ? stationId : undefined,
  );
  const overview = useInsightsOverview(
    tab === 'overview' ? teamId : undefined,
    DEFAULT_PERIOD,
  );
  const harnesses = useHarnesses();

  if (tab === 'overview') {
    return [outcomes, overview].some(loading);
  }
  if (tab === 'config') {
    return [outcomes, judge, harnesses].some(loading);
  }
  return false;
}
