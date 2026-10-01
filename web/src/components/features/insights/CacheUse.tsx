import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  cacheShown,
  type InsightsCost,
  type StationNames,
  stationShown,
} from '@/lib/insights';
import { tokensShown } from '@/lib/run';
import { stationPath } from '@/lib/station';

type StationCache = InsightsCost['cost']['cacheByStation'][number];

type CacheUseProps = {
  slug: string;
  teamId: string;
  stations: readonly StationCache[];
  names: StationNames;
};

export function CacheUse({ slug, teamId, stations, names }: CacheUseProps) {
  const columns: InsightsColumn<StationCache>[] = [
    {
      id: 'station',
      header: 'Station',
      cell: (station) => {
        const named = names.get(station.stationId);

        return named ? (
          <TrailLink
            to={stationPath(slug, teamId, named.lineId, station.stationId)}
            className="hover:underline"
          >
            {named.stationName}
          </TrailLink>
        ) : (
          stationShown(names, station.stationId)
        );
      },
    },
    {
      id: 'share',
      header: 'Cache share',
      numeric: true,
      cell: (station) => cacheShown(station.cacheShare),
    },
    {
      id: 'read',
      header: 'Cache read',
      numeric: true,
      cell: (station) => tokensShown(station.cacheRead),
    },
    {
      id: 'written',
      header: 'Cache write',
      numeric: true,
      cell: (station) => tokensShown(station.cacheWrite),
    },
    {
      id: 'input',
      header: 'Input',
      numeric: true,
      cell: (station) => tokensShown(station.input),
    },
  ];

  return (
    <InsightsCard
      title="Read from cache"
      description="Cache reads as a share of everything read: input, cache reads and cache writes, in tokens. Runs whose harness did not count input and cache reads are left out."
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          No station reported its tokens.
        </p>
      ) : (
        <InsightsTable
          label="Cache share by station"
          columns={columns}
          rows={stations}
          rowKey={(station) => station.stationId}
        />
      )}
    </InsightsCard>
  );
}
