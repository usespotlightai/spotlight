import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  CACHE_HEADINGS,
  CACHE_NOTE,
  formatCache,
  formatStation,
  type InsightsCost,
  type StationNames,
} from '@/lib/insights';
import { formatTokens } from '@/lib/run';
import { stationPath } from '@/lib/station';
import { cn } from '@/lib/utils';

type StationCache = InsightsCost['cost']['cacheByStation'][number];

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
      scrolls
      title="Read from cache"
      description={CACHE_NOTE}
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          No station reported tokens in this period.
        </p>
      ) : (
        <NestedTable label="Cache share by station" headings={CACHE_HEADINGS}>
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
                    formatStation(names, station.stationId)
                  )}
                </span>
                <NestedCell heading="Cache share" strong>
                  {formatCache(station.cacheShare)}
                </NestedCell>
                <NestedCell heading="Cache read">
                  {formatTokens(station.cacheRead)}
                </NestedCell>
                <NestedCell heading="Cache write">
                  {formatTokens(station.cacheWrite)}
                </NestedCell>
                <NestedCell heading="Input">
                  {formatTokens(station.input)}
                </NestedCell>
              </li>
            );
          })}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
