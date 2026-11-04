import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { StationTrend } from '@/components/features/insights/StationTrend';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import type { TallyCountedResponseDto } from '@/lib/api';
import {
  formatStation,
  type StationNames,
  type StationReport,
  stationAnchor,
} from '@/lib/insights';
import {
  stationTableColumns,
  stationTableHeadings,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

type StationsTableProps = {
  stations: readonly StationReport[];
  counted: TallyCountedResponseDto;
  names: StationNames;
};

export function StationsTable({
  stations,
  counted,
  names,
}: StationsTableProps) {
  const columns = stationTableColumns(counted);

  return (
    <NestedTable
      label="How each station’s runs went"
      headings={stationTableHeadings(counted)}
      compact
    >
      {stations.map((report) => (
        <li
          key={report.stationId}
          id={stationAnchor(report.stationId)}
          data-slot="station-report"
          className={cn(TABLE_ROW, 'scroll-mt-4', ROW_DIVIDER)}
        >
          <p className={cn(LEAD_CELL, 'items-baseline', EDGE_INDENT)}>
            <InsightsLink
              tab="stations"
              filter={{ stationId: report.stationId }}
              className="truncate text-foreground hover:underline"
            >
              {formatStation(names, report.stationId)}
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
                  tab="traces"
                  filter={{
                    stationId: report.stationId,
                    ...(column.label === 'Failed' && { outcome: 'failed' }),
                  }}
                  className={cn(
                    'hover:underline',
                    column.label === 'Failed' && report.tally.failed > 0
                      ? 'text-outcome-failed'
                      : 'text-foreground',
                  )}
                >
                  {column.render(report.tally)}
                </InsightsLink>
              </NestedCell>
            ) : (
              <NestedCell key={column.label} heading={column.label}>
                {column.render(report.tally)}
              </NestedCell>
            ),
          )}
        </li>
      ))}
    </NestedTable>
  );
}
