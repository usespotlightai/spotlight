import { useStationImprovement } from '@/hooks/api/useStationImprovement';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { useStationJudge } from '@/hooks/api/useStationJudge';
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
  const improvement = useStationImprovement(teamId, lineId, stationId);
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const judge = useStationJudge(teamId, lineId, stationId);

  return [improvement, outcomes, judge].some(loading);
}
