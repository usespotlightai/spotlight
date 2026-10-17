import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { spentIn } from '@/lib/inbox';
import {
  type DayOutput,
  formatCount,
  formatStation,
  type StationNames,
} from '@/lib/insights';
import { changeKey } from '@/lib/insights-changes';
import { formatDay } from '@/lib/judge';
import { stationPath } from '@/lib/station';

type OutputTableProps = {
  slug: string;
  teamId: string;
  days: readonly DayOutput[];
  currency: string | null;
  names: StationNames;
};

export function OutputTable({
  slug,
  teamId,
  days,
  currency,
  names,
}: OutputTableProps) {
  const columns: InsightsColumn<DayOutput>[] = [
    {
      id: 'day',
      header: 'Day',
      cell: (day) => formatDay(day.day),
    },
    {
      id: 'runs',
      header: 'Runs',
      numeric: true,
      cell: (day) =>
        day.runs > 0 ? (
          <InsightsLink tab="runs" filter={{ day: day.day }}>
            {formatCount(day.runs)}
          </InsightsLink>
        ) : (
          '0'
        ),
    },
    {
      id: 'spend',
      header: 'Spend',
      numeric: true,
      cell: (day) =>
        day.spend && currency ? spentIn(day.spend.amount, currency) : '–',
    },
    {
      id: 'merged',
      header: 'PRs merged',
      numeric: true,
      cell: (day) => formatCount(day.merged),
    },
    {
      id: 'changes',
      header: 'Config changes',
      cell: (day) =>
        day.changes.length === 0 ? (
          '–'
        ) : (
          <span className="flex gap-2">
            {day.changes.map((change) => (
              <TrailLink
                key={changeKey(change)}
                to={stationPath(slug, teamId, change.lineId, change.stationId)}
                className="hover:underline"
              >
                {formatStation(names, change.stationId)}
              </TrailLink>
            ))}
          </span>
        ),
    },
  ];

  return (
    <InsightsTable
      label="Output against cost, by day"
      columns={columns}
      rows={days}
      rowKey={(day) => day.day}
    />
  );
}
