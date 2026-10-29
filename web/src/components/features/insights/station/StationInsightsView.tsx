import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { StationInsights } from '@/components/features/insights/station/StationInsights';
import { StationInsightsSkeleton } from '@/components/features/insights/station/StationInsightsSkeleton';
import { useInsightsStations } from '@/hooks/api/useInsightsStations';
import { useStation } from '@/hooks/api/useStation';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { useStationJudge } from '@/hooks/api/useStationJudge';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type StationInsightsViewProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
  stationId: string;
};

export function StationInsightsView({
  slug,
  teamId,
  period,
  names,
  stationId,
}: StationInsightsViewProps) {
  const stations = useInsightsStations(teamId, period);
  const report = stations.data?.stations.find(
    (each) => each.stationId === stationId,
  );
  const lineId = names.get(stationId)?.lineId ?? report?.lineId;
  const { lines, station } = useStation(teamId, lineId, stationId);
  const judged = Boolean(station?.judge);
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const judge = useStationJudge(teamId, lineId, judged ? stationId : undefined);
  const waiting =
    loading(stations) ||
    loading(lines) ||
    (lineId !== undefined && loading(outcomes)) ||
    (judged && loading(judge));

  useScrollToHash(!waiting);

  if (waiting) {
    return (
      <StationInsightsSkeleton
        stationId={stationId}
        names={names}
        judged={judged}
      />
    );
  }

  if (failed(stations) || !stations.data) {
    return <InsightsFailed what="The stations" query={stations} />;
  }

  return (
    <StationInsights
      slug={slug}
      teamId={teamId}
      stationId={stationId}
      report={report}
      names={names}
    />
  );
}
