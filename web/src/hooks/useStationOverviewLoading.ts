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
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const judge = useStationJudge(teamId, lineId, stationId);

  return [outcomes, judge].some(loading);
}
