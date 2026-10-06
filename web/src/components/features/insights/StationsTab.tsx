import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { StationReportRow } from '@/components/features/insights/StationReportRow';
import { StationsSkeleton } from '@/components/features/insights/StationsSkeleton';
import { StationsTable } from '@/components/features/insights/StationsTable';
import { StationInsights } from '@/components/features/insights/station/StationInsights';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { StationTallyFigures } from '@/components/features/stations/outcomes/StationTallyFigures';
import { useInsightsStations } from '@/hooks/api/useInsightsStations';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import {
  deltaOf,
  type InsightsPeriod,
  type StationNames,
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

  const { team, teamBefore, stations: reports, truncated } = stations.data;

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

  const delta = deltaOf(team.runs, teamBefore.runs, 'neither');

  return (
    <div className="flex flex-col gap-3">
      {truncated && <TruncatedNote />}

      <InsightsCard
        title="The whole team"
        actions={delta && <DeltaShown delta={delta} />}
      >
        <StationTallyFigures tally={team} />
      </InsightsCard>

      <InsightsCard
        title="By station"
        description="Same counts as each station’s page. The line shows runs per day, failures in red."
        table={
          <StationsTable
            slug={slug}
            teamId={teamId}
            stations={reports}
            names={names}
          />
        }
      >
        <ul
          aria-label="Stations"
          className="flex flex-col divide-y divide-border"
        >
          {reports.map((report) => (
            <StationReportRow
              key={report.stationId}
              slug={slug}
              teamId={teamId}
              report={report}
              names={names}
            />
          ))}
        </ul>
      </InsightsCard>
    </div>
  );
}
