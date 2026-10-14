import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  cacheShown,
  type InsightsCost,
  type StationNames,
  stationShown,
} from '@/lib/insights';
import { SPREAD } from '@/lib/nested-table';
import { tokensShown } from '@/lib/run';
import { stationPath } from '@/lib/station';
import { cn } from '@/lib/utils';

type StationCache = InsightsCost['cost']['cacheByStation'][number];

const HEADINGS = [
  { label: 'Station', indent: 'edge' as const, size: 'minmax(10rem,2fr)' },
  { label: 'Cache share', numeric: true, size: SPREAD },
  { label: 'Cache read', numeric: true, size: SPREAD },
  { label: 'Cache write', numeric: true, size: SPREAD },
  { label: 'Input', numeric: true, size: SPREAD },
];

type CacheUseProps = {
  slug: string;
  teamId: string;
  stations: readonly StationCache[];
  names: StationNames;
};

export function CacheUse({ slug, teamId, stations, names }: CacheUseProps) {
  return (
    <InsightsCard
      tableOnly={stations.length > 0}
      title="Read from cache"
      description="Cache reads as a share of all tokens read, which are input, cache reads and cache writes. If a harness doesn’t report input or cache reads, its runs don’t count."
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          No station reported tokens in this period.
        </p>
      ) : (
        <NestedTable label="Cache share by station" headings={HEADINGS}>
          {stations.map((station) => {
            const named = names.get(station.stationId);

            return (
              <li
                key={station.stationId}
                data-slot="station-cache"
                className={cn(
                  'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs @4xl:grid-cols-subgrid',
                  ROW_DIVIDER,
                )}
              >
                <span
                  className={cn(
                    'col-span-full min-w-0 truncate font-medium text-foreground @4xl:col-span-1',
                    EDGE_INDENT,
                  )}
                >
                  {named ? (
                    <TrailLink
                      to={stationPath(
                        slug,
                        teamId,
                        named.lineId,
                        station.stationId,
                      )}
                      className="hover:underline"
                    >
                      {named.stationName}
                    </TrailLink>
                  ) : (
                    stationShown(names, station.stationId)
                  )}
                </span>
                <NestedCell heading="Cache share" strong>
                  {cacheShown(station.cacheShare)}
                </NestedCell>
                <NestedCell heading="Cache read">
                  {tokensShown(station.cacheRead)}
                </NestedCell>
                <NestedCell heading="Cache write">
                  {tokensShown(station.cacheWrite)}
                </NestedCell>
                <NestedCell heading="Input">
                  {tokensShown(station.input)}
                </NestedCell>
              </li>
            );
          })}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
