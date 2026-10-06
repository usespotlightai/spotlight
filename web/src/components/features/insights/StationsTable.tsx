import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { StationTrend } from '@/components/features/insights/StationTrend';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import {
  type StationNames,
  type StationReport,
  stationAnchor,
  stationShown,
} from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { countedColumnsOf } from '@/lib/station-outcomes';
import { cn } from '@/lib/utils';

type StationsTableProps = {
  stations: readonly StationReport[];
  names: StationNames;
};

export function StationsTable({ stations, names }: StationsTableProps) {
  const columns = countedColumnsOf(stations.map((report) => report.tally));
  const headings: NestedHeading[] = [
    { label: 'Station', indent: 'edge', size: 'minmax(10rem,2fr)' },
    { label: 'Runs per day', size: 'max-content' },
    ...columns.map((column) => ({
      label: column.label,
      numeric: true,
      size: SPREAD,
    })),
  ];

  return (
    <NestedTable label="How each station’s runs went" headings={headings}>
      {stations.map((report) => (
        <li
          key={report.stationId}
          id={stationAnchor(report.stationId)}
          data-slot="station-report"
          className={cn(
            'col-span-full grid scroll-mt-4 grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
            ROW_DIVIDER,
          )}
        >
          <p
            className={cn(
              'col-span-full flex min-w-0 items-baseline gap-2 text-xs @4xl:col-span-1',
              EDGE_INDENT,
            )}
          >
            <InsightsLink
              tab="stations"
              filter={{ stationId: report.stationId }}
              className="truncate font-medium text-foreground hover:underline"
            >
              {stationShown(names, report.stationId)}
            </InsightsLink>
            <span className="truncate text-muted-foreground">
              {names.get(report.stationId)?.lineName}
            </span>
          </p>
          <StationTrend report={report} />
          {columns.map((column) =>
            column.label === 'Runs' || column.label === 'Failed' ? (
              <NestedCell key={column.label} heading={column.label}>
                <InsightsLink
                  tab="runs"
                  filter={{
                    stationId: report.stationId,
                    ...(column.label === 'Failed' && { outcome: 'failed' }),
                  }}
                  className={cn(
                    'hover:underline',
                    column.label === 'Failed' && report.tally.failed > 0
                      ? 'text-destructive'
                      : 'text-foreground',
                  )}
                >
                  {column.shown(report.tally)}
                </InsightsLink>
              </NestedCell>
            ) : (
              <NestedCell
                key={column.label}
                heading={column.label}
                strong={column.label === 'Cost'}
              >
                {column.shown(report.tally)}
              </NestedCell>
            ),
          )}
        </li>
      ))}
    </NestedTable>
  );
}
