import { TileSparkline } from '@/components/features/insights/TileSparkline';
import { RunStrip } from '@/components/features/stations/activity/RunStrip';
import { SummarySkeleton } from '@/components/features/stations/activity/SummarySkeleton';
import { SummaryTile } from '@/components/features/stations/activity/SummaryTile';
import { TabSection } from '@/components/features/stations/TabSection';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { formatPercent } from '@/lib/judge';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import {
  liveRuns,
  SUMMARY_COLUMNS,
  SUMMARY_GRID,
  SUMMARY_TITLE,
  type SummaryColumn,
} from '@/lib/station-insights';

const trendable = (values: readonly (number | null)[]): boolean =>
  new Set(values.filter((value) => value !== null)).size > 1;

type StationSummaryProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationSummary({
  slug,
  teamId,
  lineId,
  stationId,
}: StationSummaryProps) {
  const outcomes = useStationInsights(teamId, lineId, stationId);
  const inForce = outcomes.data?.inForce;

  if (loading(outcomes)) {
    return <SummarySkeleton />;
  }

  if (failed(outcomes) || !inForce) {
    return null;
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
        <TileSparkline label="Cost, run by run" values={costs} tone="done" />
      ) : null;
    }
    if (visual === 'duration') {
      return trendable(durations) ? (
        <TileSparkline
          label="Duration, run by run"
          values={durations}
          tone="done"
        />
      ) : null;
    }

    return null;
  };

  return (
    <TabSection
      title={SUMMARY_TITLE}
      action={
        <SectionLink to={stationInsightsPath(slug, teamId, stationId)}>
          See in Insights
        </SectionLink>
      }
    >
      <dl
        aria-label={SUMMARY_TITLE}
        data-slot="station-summary"
        className={SUMMARY_GRID}
      >
        {SUMMARY_COLUMNS.map((column) => (
          <SummaryTile
            key={column.label}
            label={column.label}
            value={column.render(tally)}
            detail={
              column.counted && tally.runs > 0
                ? formatPercent(tally[column.counted] / tally.runs)
                : undefined
            }
          >
            {visualOf(column)}
          </SummaryTile>
        ))}
      </dl>
    </TabSection>
  );
}
