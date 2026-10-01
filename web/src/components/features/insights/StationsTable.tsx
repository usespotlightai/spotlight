import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  type StationNames,
  type StationReport,
  stationShown,
} from '@/lib/insights';
import { stationPath } from '@/lib/station';
import { TALLY_COLUMNS } from '@/lib/station-outcomes';

type StationsTableProps = {
  slug: string;
  teamId: string;
  stations: readonly StationReport[];
  names: StationNames;
};

export function StationsTable({
  slug,
  teamId,
  stations,
  names,
}: StationsTableProps) {
  const columns: InsightsColumn<StationReport>[] = [
    {
      id: 'station',
      header: 'Station',
      cell: (report) => (
        <TrailLink
          to={stationPath(slug, teamId, report.lineId, report.stationId)}
          className="hover:underline"
        >
          {stationShown(names, report.stationId)}
        </TrailLink>
      ),
    },
    ...TALLY_COLUMNS.map(
      (column): InsightsColumn<StationReport> => ({
        id: column.label,
        header: column.label,
        numeric: true,
        cell: (report) => column.shown(report.tally),
      }),
    ),
  ];

  return (
    <InsightsTable
      label="How each station’s runs went"
      columns={columns}
      rows={stations}
      rowKey={(report) => report.stationId}
    />
  );
}
