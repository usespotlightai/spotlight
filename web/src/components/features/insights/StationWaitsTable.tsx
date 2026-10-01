import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  countShown,
  deltaOf,
  type StationFlow,
  type StationNames,
  spreadShown,
  stationShown,
} from '@/lib/insights';
import { stationPath } from '@/lib/station';

type StationWaitsTableProps = {
  slug: string;
  teamId: string;
  stations: readonly StationFlow[];
  before: readonly StationFlow[];
  names: StationNames;
};

export function StationWaitsTable({
  slug,
  teamId,
  stations,
  before,
  names,
}: StationWaitsTableProps) {
  const tasksBefore = (stationId: string) =>
    before.find((each) => each.stationId === stationId)?.tasks ?? 0;

  const columns: InsightsColumn<StationFlow>[] = [
    {
      id: 'station',
      header: 'Station',
      cell: (station) => (
        <TrailLink
          to={stationPath(slug, teamId, station.lineId, station.stationId)}
          className="hover:underline"
        >
          {stationShown(names, station.stationId)}
        </TrailLink>
      ),
    },
    {
      id: 'tasks',
      header: 'Tasks',
      numeric: true,
      cell: (station) => {
        const delta = deltaOf(
          station.tasks,
          tasksBefore(station.stationId),
          'neither',
        );

        return (
          <span className="flex flex-col items-end">
            <InsightsLink tab="runs" filter={{ stationId: station.stationId }}>
              {countShown(station.tasks)}
            </InsightsLink>
            {delta && <DeltaShown delta={delta} />}
          </span>
        );
      },
    },
    {
      id: 'runs',
      header: 'Runs',
      numeric: true,
      cell: (station) => countShown(station.runs),
    },
    {
      id: 'queued',
      header: 'Queued',
      numeric: true,
      cell: (station) => spreadShown(station.queued),
    },
    {
      id: 'running',
      header: 'Running',
      numeric: true,
      cell: (station) => spreadShown(station.running),
    },
    {
      id: 'inbox',
      header: 'In the inbox',
      numeric: true,
      cell: (station) => spreadShown(station.inbox),
    },
    {
      id: 'asks',
      header: 'Asks',
      numeric: true,
      cell: (station) => countShown(station.asks),
    },
    {
      id: 'unanswered',
      header: 'Unanswered',
      numeric: true,
      cell: (station) => countShown(station.unanswered),
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
