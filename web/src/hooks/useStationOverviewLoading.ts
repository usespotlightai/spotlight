import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { DEFAULT_PERIOD } from '@/lib/insights';
import { loading } from '@/lib/query';

type StationIds = {
  readonly teamId?: string;
  readonly lineId?: string;
  readonly stationId?: string;
};

export function useStationOverviewLoading({
  teamId,
  lineId,
  stationId,
}: StationIds): boolean {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const judge = useStationJudge(teamId, lineId, stationId);
  const overview = useInsightsOverview(teamId, DEFAULT_PERIOD);
  const harnesses = useHarnesses();

  return [outcomes, judge, overview, harnesses].some(loading);
}
