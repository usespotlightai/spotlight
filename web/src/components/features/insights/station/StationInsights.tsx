import { ChevronLeft } from 'lucide-react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { StationFailures } from '@/components/features/insights/StationFailures';
import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import { StationOutcomes } from '@/components/features/stations/outcomes/StationOutcomes';
import { StationSection } from '@/components/features/stations/StationSection';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStation } from '@/hooks/api/useStation';
import {
  deltaOf,
  type StationNames,
  type StationReport,
  stationShown,
  trendOf,
} from '@/lib/insights';
import { JUDGE_ANCHOR, stationPath } from '@/lib/station';
import { PERIOD_COLUMNS } from '@/lib/station-outcomes';

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
  const delta =
    report && deltaOf(report.tally.runs, report.before.runs, 'neither');

  return (
    <div data-slot="station-insights" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <InsightsLink
          tab="stations"
          className="flex w-fit items-center gap-0.5 text-muted-foreground text-xs hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-3.5" />
          All stations
        </InsightsLink>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="font-semibold text-foreground text-lg tracking-tight">
            {stationShown(names, stationId)}
          </h2>
          {named && (
            <span className="text-muted-foreground text-sm">
              {named.lineName}
            </span>
          )}
          {lineId && (
            <span className="ml-auto">
              <SectionLink to={stationPath(slug, teamId, lineId, stationId)}>
                Open station
              </SectionLink>
            </span>
          )}
        </div>
      </div>

      {report ? (
        <>
          <InsightsTiles label="Over this period">
            {PERIOD_COLUMNS.map((column) => (
              <InsightsTile
                key={column.label}
                label={column.label}
                value={column.shown(report.tally)}
                delta={column.label === 'Runs' ? delta : undefined}
                trend={
                  column.label === 'Runs'
                    ? trendOf(report.trend).map((day) => day.runs)
                    : column.label === 'Failed'
                      ? trendOf(report.trend).map((day) => day.failed)
                      : undefined
                }
              />
            ))}
          </InsightsTiles>

          <InsightsCard title="Why runs failed">
            <StationFailures slug={slug} teamId={teamId} report={report} />
          </InsightsCard>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No runs at this station in this period.
        </p>
      )}

      {lineId && (
        <StationSection title="Runs by config">
          <p className="-mt-1 text-muted-foreground text-xs">
            Each config change starts a new group. Compare runs before and after
            it.
          </p>
          <StationOutcomes
            slug={slug}
            teamId={teamId}
            lineId={lineId}
            stationId={stationId}
          />
        </StationSection>
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
