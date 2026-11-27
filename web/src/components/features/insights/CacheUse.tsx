import type { ReactNode } from 'react';

import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
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
      flat
      tableOnly={stations.length > 0}
      title="Cache share by station"
      description={CACHE_NOTE}
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          No station reported tokens in this period.
        </p>
      ) : (
        <NestedTable
          label="Cache share by station"
          headings={CACHE_HEADINGS}
          compact
        >
          {stations.map((station) => {
            const named = names.get(station.stationId);

            return (
              <li
                key={station.stationId}
                data-slot="station-cache"
                className={cn(
                  TABLE_ROW,
                  ROW_DIVIDER,
                  'grid-cols-3 gap-x-3 gap-y-0.5',
                )}
              >
                <span
                  className={cn(
                    LEAD_CELL,
                    'col-span-2 truncate text-foreground',
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
                <CacheCell heading="Cache share" strong>
                  {formatCache(station.cacheRate)}
                </CacheCell>
                <CacheCell heading="Cache read">
                  {formatTokens(station.cacheRead)}
                </CacheCell>
                <CacheCell heading="Cache write">
                  {formatTokens(station.cacheWrite)}
                </CacheCell>
                <CacheCell heading="Input">
                  {formatTokens(station.input)}
                </CacheCell>
              </li>
            );
          })}
        </NestedTable>
      )}
    </InsightsCard>
  );
}

type CacheCellProps = {
  heading: string;
  strong?: boolean;
  children: ReactNode;
};

function CacheCell({ heading, strong = false, children }: CacheCellProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col tabular-nums @lg:group-data-compact/nested:block @lg:group-data-compact/nested:pl-0 @lg:group-data-compact/nested:text-right @lg:group-data-compact/nested:text-sm',
        strong
          ? 'text-right text-foreground text-sm'
          : 'pl-2 text-muted-foreground text-xs',
      )}
    >
      <span
        className={cn(
          'text-muted-foreground text-xs @lg:group-data-compact/nested:hidden',
          strong && 'sr-only',
        )}
      >
        {heading}
      </span>
      {children}
    </span>
  );
}
