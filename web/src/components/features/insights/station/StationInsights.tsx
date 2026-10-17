import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { StationFailures } from '@/components/features/insights/StationFailures';
import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import { StationOutcomes } from '@/components/features/stations/outcomes/StationOutcomes';
import { StationSection } from '@/components/features/stations/StationSection';
import { useStation } from '@/hooks/api/useStation';
import {
  failedAny,
  formatStation,
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
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-semibold text-foreground text-lg tracking-tight">
          {formatStation(names, stationId)}
        </h2>
        {named && (
          <span className="text-muted-foreground text-sm">
            {named.lineName}
          </span>
        )}
      </div>

      {report ? (
        <>
          <InsightsTiles label="Over this period">
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
            <InsightsCard title="Why runs failed">
              <StationFailures slug={slug} teamId={teamId} report={report} />
            </InsightsCard>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No runs at this station in this period.
        </p>
      )}

      {lineId && (
        <InsightsCard
          title="Runs by config"
          description="Each config change starts a new group. Compare runs before and after it."
        >
          <StationOutcomes
            slug={slug}
            teamId={teamId}
            lineId={lineId}
            stationId={stationId}
          />
        </InsightsCard>
      )}

      {lineId && station?.judge && (
        <StationSection title="How far to trust the judge" id={JUDGE_ANCHOR}>
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
