import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { StationFailures } from '@/components/features/insights/StationFailures';
import { StationInsightsHeading } from '@/components/features/insights/station/StationInsightsHeading';
import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import { StationRunOutcomes } from '@/components/features/stations/outcomes/StationRunOutcomes';
import { StationSection } from '@/components/features/stations/StationSection';
import { useStation } from '@/hooks/api/useStation';
import {
  failedAny,
  RUNS_BY_CONFIG_NOTE,
  type StationNames,
  type StationReport,
  tallyTiles,
  trendOf,
} from '@/lib/insights';
import { JUDGE_ANCHOR } from '@/lib/station';

type StationInsightsProps = {
  slug: string;
  teamId: string;
  stationId: string;
  report: StationReport | undefined;
  names: StationNames;
};

export function StationInsights({
  slug,
  teamId,
  stationId,
  report,
  names,
}: StationInsightsProps) {
  const named = names.get(stationId);
  const lineId = named?.lineId ?? report?.lineId;
  const { station } = useStation(teamId, lineId, stationId);

  return (
    <div data-slot="station-insights" className="flex flex-col gap-6">
      <StationInsightsHeading stationId={stationId} names={names} />

      {report && (
        <>
          <InsightsTiles label="Over this period" topAligned>
            {tallyTiles(
              report.tally,
              report.seen,
              report.changes,
              trendOf(report.trend),
              { stationId },
            ).map((tile) => (
              <InsightsTile
                key={tile.id}
                label={tile.label}
                value={tile.value}
                detail={tile.detail}
                delta={tile.delta}
                drill={tile.drill}
                trend={tile.trend}
              />
            ))}
          </InsightsTiles>

          {failedAny(report) && (
            <InsightsCard scrolls title="Why runs failed">
              <StationFailures slug={slug} teamId={teamId} report={report} />
            </InsightsCard>
          )}
        </>
      )}

      {lineId && (
        <InsightsCard
          scrolls
          title="Runs by config"
          description={RUNS_BY_CONFIG_NOTE}
        >
          <StationRunOutcomes
            slug={slug}
            teamId={teamId}
            lineId={lineId}
            stationId={stationId}
          />
        </InsightsCard>
      )}

      {lineId && station?.judge && (
        <StationSection
          title="How far the judge agrees with people"
          id={JUDGE_ANCHOR}
        >
          <JudgeAgreement
            slug={slug}
            teamId={teamId}
            lineId={lineId}
            stationId={stationId}
          />
        </StationSection>
      )}
    </div>
  );
}
