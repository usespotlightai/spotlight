import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { StationsSkeleton } from '@/components/features/insights/StationsSkeleton';
import { StationsTable } from '@/components/features/insights/StationsTable';
import { StationInsights } from '@/components/features/insights/station/StationInsights';
import { useInsightsStations } from '@/hooks/api/useInsightsStations';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import {
  type InsightsPeriod,
  type StationNames,
  tallyTiles,
  trendOf,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type StationsTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
  stationId?: string;
};

export function StationsTab({
  slug,
  teamId,
  period,
  names,
  stationId,
}: StationsTabProps) {
  const stations = useInsightsStations(teamId, period);
  useScrollToHash(Boolean(stations.data));

  if (loading(stations)) {
    return <StationsSkeleton />;
  }

  if (failed(stations) || !stations.data) {
    return <InsightsFailed what="The stations" query={stations} />;
  }

  const {
    team,
    teamSeen,
    teamCounted,
    teamChanges,
    teamTrend,
    stations: reports,
  } = stations.data;

  if (stationId) {
    return (
      <StationInsights
        slug={slug}
        teamId={teamId}
        stationId={stationId}
        report={reports.find((each) => each.stationId === stationId)}
        names={names}
      />
    );
  }

  if (reports.length === 0) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Each station’s runs show here once stations run tasks.
      </NoRunsInPeriod>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <InsightsTiles label="The whole team">
        {tallyTiles(team, teamSeen, teamChanges, trendOf(teamTrend)).map(
          (tile) => (
            <InsightsTile
              key={tile.id}
              label={tile.label}
              value={tile.value}
              detail={tile.detail}
              delta={tile.delta}
              drill={tile.drill}
              trend={tile.trend}
            />
          ),
        )}
      </InsightsTiles>

      <InsightsCard
        title="By station"
        description="The counts are the same as on each station’s page. The line shows runs per day, with failures in red. The number beside it is the change in runs since the previous period."
      >
        <StationsTable stations={reports} counted={teamCounted} names={names} />
      </InsightsCard>
    </div>
  );
}
