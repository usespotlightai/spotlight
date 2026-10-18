import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { SpreadShown } from '@/components/features/insights/SpreadShown';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  formatCount,
  formatMedian,
  formatStation,
  formatTail,
  type StationFlow,
  type StationNames,
  shownDeltaOf,
} from '@/lib/insights';
import { stationPath } from '@/lib/station';

type StationWaitsTableProps = {
  slug: string;
  teamId: string;
  stations: readonly StationFlow[];
  names: StationNames;
};

export function StationWaitsTable({
  slug,
  teamId,
  stations,
  names,
}: StationWaitsTableProps) {
  const columns: InsightsColumn<StationFlow>[] = [
    {
      id: 'station',
      header: 'Station',
      cell: (station) => (
        <TrailLink
          to={stationPath(slug, teamId, station.lineId, station.stationId)}
          className="hover:underline"
        >
          {formatStation(names, station.stationId)}
        </TrailLink>
      ),
    },
    {
      id: 'tasks',
      header: 'Tasks',
      numeric: true,
      cell: (station) => {
        const delta = shownDeltaOf(station.tasksChange);

        return (
          <span className="inline-flex items-center gap-2">
            <InsightsLink tab="runs" filter={{ stationId: station.stationId }}>
              {formatCount(station.tasks)}
            </InsightsLink>
            {delta && <DeltaGlyph delta={delta} />}
          </span>
        );
      },
    },
    {
      id: 'runs',
      header: 'Runs',
      numeric: true,
      cell: (station) => formatCount(station.runs),
    },
    {
      id: 'queued',
      header: 'Queued',
      numeric: true,
      cell: (station) => (
        <SpreadShown tail={formatTail(station.queued)}>
          {formatMedian(station.queued)}
        </SpreadShown>
      ),
    },
    {
      id: 'running',
      header: 'Running',
      numeric: true,
      cell: (station) => (
        <SpreadShown tail={formatTail(station.running)}>
          {formatMedian(station.running)}
        </SpreadShown>
      ),
    },
    {
      id: 'inbox',
      header: 'In the inbox',
      numeric: true,
      cell: (station) => (
        <SpreadShown tail={formatTail(station.inbox)}>
          {formatMedian(station.inbox)}
        </SpreadShown>
      ),
    },
    {
      id: 'asks',
      header: 'Asks',
      numeric: true,
      cell: (station) => formatCount(station.asks),
    },
    {
      id: 'unanswered',
      header: 'Unanswered',
      numeric: true,
      cell: (station) => formatCount(station.unanswered),
    },
  ];

  return (
    <InsightsTable
      label="Where tasks wait, by station"
      columns={columns}
      rows={stations}
      rowKey={(station) => station.stationId}
    />
  );
}
