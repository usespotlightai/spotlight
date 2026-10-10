import { TileSparkline } from '@/components/features/insights/TileSparkline';
import { GlanceSkeleton } from '@/components/features/stations/overview/GlanceSkeleton';
import { GlanceTile } from '@/components/features/stations/overview/GlanceTile';
import { RunStrip } from '@/components/features/stations/overview/RunStrip';
import { ShareBar } from '@/components/features/stations/overview/ShareBar';
import { SectionLink } from '@/components/shared/SectionLink';
import { useStationOutcomes } from '@/hooks/api/useStationOutcomes';
import { failed, loading } from '@/lib/query';
import { stationInsightsPath } from '@/lib/station';
import {
  GLANCE_COLUMNS,
  type GlanceColumn,
  runsInForce,
} from '@/lib/station-outcomes';

const TITLE = 'Latest runs on this config';

const trendable = (values: readonly (number | null)[]): boolean =>
  new Set(values.filter((value) => value !== null)).size > 1;

type StationGlanceProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationGlance({
  slug,
  teamId,
  lineId,
  stationId,
}: StationGlanceProps) {
  const outcomes = useStationOutcomes(teamId, lineId, stationId);
  const inForce = outcomes.data?.inForce;

  if (loading(outcomes)) {
    return <GlanceSkeleton />;
  }

  if (failed(outcomes) || !inForce) {
    return null;
  }

  const { tally } = inForce;
  const runs = runsInForce(outcomes.data?.groups ?? []);
  const costs = runs.map((run) => run.cost?.cost ?? null);
  const durations = runs.map((run) => run.cost?.ms ?? null);
  const visualOf = ({ visual, counted }: GlanceColumn) => {
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
        <h2 className="font-medium text-foreground text-xs">{TITLE}</h2>
        <SectionLink to={stationInsightsPath(slug, teamId, stationId)}>
          See in Insights
        </SectionLink>
      </div>
      <dl
        aria-label={TITLE}
        data-slot="station-glance"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {GLANCE_COLUMNS.map((column) => (
          <GlanceTile
            key={column.label}
            label={column.label}
            value={column.shown(tally)}
            detail={column.counted ? `of ${tally.runs} runs` : undefined}
          >
            {visualOf(column)}
          </GlanceTile>
        ))}
      </dl>
    </section>
  );
}
