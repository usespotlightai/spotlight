import { TileSparkline } from '@/components/features/insights/TileSparkline';
import { RunStrip } from '@/components/features/stations/overview/RunStrip';
import { ShareBar } from '@/components/features/stations/overview/ShareBar';
import { SummarySkeleton } from '@/components/features/stations/overview/SummarySkeleton';
import { SummaryTile } from '@/components/features/stations/overview/SummaryTile';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationInsights } from '@/hooks/api/useStationInsights';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import {
  liveRuns,
  SUMMARY_COLUMNS,
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
  const visualOf = ({ visual, counted }: SummaryColumn) => {
    if (visual === 'share') {
      return counted ? (
        <ShareBar count={tally[counted]} runs={tally.runs} />
      ) : null;
    }
    if (visual === 'strip') {
      return runs.length > 0 ? <RunStrip runs={runs} /> : null;
    }
    if (visual === 'cost') {
      return trendable(costs) ? (
        <TileSparkline label="Cost, run by run" values={costs} />
      ) : null;
    }

    return trendable(durations) ? (
      <TileSparkline label="Duration, run by run" values={durations} />
    ) : null;
  };

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-foreground text-xs">{SUMMARY_TITLE}</h2>
        <SectionLink to={stationInsightsPath(slug, teamId, stationId)}>
          See in Insights
        </SectionLink>
      </div>
      <dl
        aria-label={SUMMARY_TITLE}
        data-slot="station-summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {SUMMARY_COLUMNS.map((column) => (
          <SummaryTile
            key={column.label}
            label={column.label}
            value={column.render(tally)}
            detail={column.counted ? `of ${tally.runs} runs` : undefined}
          >
            {visualOf(column)}
          </SummaryTile>
        ))}
      </dl>
    </section>
  );
}
