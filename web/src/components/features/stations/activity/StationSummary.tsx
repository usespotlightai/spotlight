import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { TileSparkline } from '@/components/features/insights/TileSparkline';
import { OutcomesTile } from '@/components/features/stations/activity/OutcomesTile';
import { RunStrip } from '@/components/features/stations/activity/RunStrip';
import { SummarySkeleton } from '@/components/features/stations/activity/SummarySkeleton';
import { TabSection } from '@/components/features/stations/TabSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyFrame } from '@/components/shared/EmptyFrame';
import { useInsightsStations } from '@/hooks/api/useInsightsStations';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import {
  type InsightsPeriod,
  shownDeltaOf,
  stationReportOf,
  tallyTiles,
  trendOf,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { type ActivityPeriod, LIVE_CONFIG } from '@/lib/station';
import {
  liveRuns,
  OUTCOMES_TITLE,
  SUMMARY_COLUMNS,
  SUMMARY_TITLE,
  type SummaryColumn,
  summaryTitleOf,
} from '@/lib/station-insights';

const PERIOD_TILES = new Set(['runs', 'cost', 'median']);

const trendable = (values: readonly (number | null)[]): boolean =>
  new Set(values.filter((value) => value !== null)).size > 1;

type StationSummaryProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
  period: ActivityPeriod;
};

export function StationSummary({ period, ...at }: StationSummaryProps) {
  return period === LIVE_CONFIG ? (
    <LiveSummary {...at} />
  ) : (
    <PeriodSummary {...at} period={period} />
  );
}

type SummaryProps = Omit<StationSummaryProps, 'period'>;

function LiveSummary({ teamId, lineId, stationId }: SummaryProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const inForce = outcomes.data?.inForce;

  if (loading(outcomes)) {
    return <SummarySkeleton period={LIVE_CONFIG} />;
  }

  if (failed(outcomes)) {
    return null;
  }

  if (!inForce) {
    return (
      <TabSection title={SUMMARY_TITLE}>
        <p className="text-muted-foreground text-sm">No run on a config yet.</p>
      </TabSection>
    );
  }

  const { tally } = inForce;
  const runs = liveRuns(outcomes.data?.groups ?? []);
  const costs = runs.map((run) => run.usage?.cost ?? null);
  const durations = runs.map((run) => run.usage?.ms ?? null);
  const visualOf = ({ visual }: SummaryColumn) => {
    if (visual === 'strip') {
      return runs.length > 0 ? <RunStrip runs={runs} /> : null;
    }
    if (visual === 'cost') {
      return trendable(costs) ? (
        <TileSparkline label="Cost, run by run" values={costs} />
      ) : null;
    }
    if (visual === 'duration') {
      return trendable(durations) ? (
        <TileSparkline label="Duration, run by run" values={durations} />
      ) : null;
    }

    return null;
  };

  return (
    <TabSection title={SUMMARY_TITLE}>
      <div data-slot="station-summary">
        <InsightsTiles label={SUMMARY_TITLE}>
          {SUMMARY_COLUMNS.flatMap((column) => [
            <InsightsTile
              key={column.label}
              label={column.label}
              value={column.render(tally)}
              visual={visualOf(column)}
            />,
            ...(column.label === 'Runs'
              ? [<OutcomesTile key={OUTCOMES_TITLE} tally={tally} />]
              : []),
          ])}
        </InsightsTiles>
      </div>
    </TabSection>
  );
}

function PeriodSummary({
  slug,
  teamId,
  stationId,
  period,
}: SummaryProps & { period: InsightsPeriod }) {
  const stations = useInsightsStations(teamId, period);
  const report = stationReportOf(stations.data, stationId);
  const title = summaryTitleOf(period);

  if (loading(stations)) {
    return <SummarySkeleton period={period} />;
  }

  return (
    <TabSection title={title}>
      {failed(stations) ? (
        <EmptyFrame>
          <CouldNotLoad
            what="The station’s runs"
            retrying={stations.isFetching}
            onRetry={() => void stations.refetch()}
          />
        </EmptyFrame>
      ) : report ? (
        <div data-slot="station-summary">
          <InsightsTiles label={title}>
            {tallyTiles(
              report.tally,
              report.seen,
              report.changes,
              trendOf(report.trend),
              { stationId },
            )
              .filter((tile) => PERIOD_TILES.has(tile.id))
              .flatMap((tile) => [
                <InsightsTile
                  key={tile.id}
                  label={tile.label}
                  value={tile.value}
                  detail={tile.detail}
                  tooltip={tile.tooltip}
                  delta={tile.delta}
                  drill={tile.drill}
                  trend={tile.trend}
                />,
                ...(tile.id === 'runs'
                  ? [
                      <OutcomesTile
                        key={OUTCOMES_TITLE}
                        tally={report.tally}
                        changes={{
                          accepted: shownDeltaOf(report.changes.accepted),
                          sentBack: shownDeltaOf(report.changes.sentBack),
                          failed: shownDeltaOf(report.changes.failed),
                          merged: shownDeltaOf(report.changes.merged),
                        }}
                      />,
                    ]
                  : []),
              ])}
          </InsightsTiles>
        </div>
      ) : (
        <NoRunsInPeriod slug={slug} teamId={teamId}>
          The station’s runs show here once it runs in this period.
        </NoRunsInPeriod>
      )}
    </TabSection>
  );
}
