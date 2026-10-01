import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { StationFailures } from '@/components/features/insights/StationFailures';
import { TallySparkline } from '@/components/features/insights/TallySparkline';
import { StationTallyFigures } from '@/components/features/stations/outcomes/StationTallyFigures';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  countShown,
  deltaOf,
  type StationNames,
  type StationReport,
  stationAnchor,
  stationShown,
  trendOf,
} from '@/lib/insights';
import { stationPath } from '@/lib/station';

type StationReportRowProps = {
  slug: string;
  teamId: string;
  report: StationReport;
  names: StationNames;
};

export function StationReportRow({
  slug,
  teamId,
  report,
  names,
}: StationReportRowProps) {
  const named = names.get(report.stationId);
  const delta = deltaOf(report.tally.runs, report.before.runs, 'neither');

  return (
    <li
      id={stationAnchor(report.stationId)}
      data-slot="station-report"
      className="flex scroll-mt-4 flex-col gap-2 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <TrailLink
              to={stationPath(slug, teamId, report.lineId, report.stationId)}
              className="font-medium text-foreground hover:underline"
            >
              {stationShown(names, report.stationId)}
            </TrailLink>
            {named && (
              <span className="text-muted-foreground text-xs">
                {named.lineName}
              </span>
            )}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <InsightsLink
              tab="runs"
              filter={{ stationId: report.stationId }}
              className="text-foreground"
            >
              {countShown(report.tally.runs)}{' '}
              {report.tally.runs === 1 ? 'run' : 'runs'}
            </InsightsLink>
            {report.tally.failed > 0 && (
              <InsightsLink
                tab="runs"
                filter={{ stationId: report.stationId, outcome: 'failed' }}
                className="text-destructive"
              >
                {countShown(report.tally.failed)} failed
              </InsightsLink>
            )}
            {delta && <DeltaShown delta={delta} />}
          </p>
        </div>

        <TallySparkline trend={trendOf(report.trend)} />
      </div>

      <StationTallyFigures tally={report.tally} />

      <StationFailures slug={slug} teamId={teamId} report={report} />
    </li>
  );
}
