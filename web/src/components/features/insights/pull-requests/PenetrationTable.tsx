import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { formatCount, formatShare } from '@/lib/insights';
import { type WeekShare, weekFilter } from '@/lib/insights-pull-requests';
import { formatDay } from '@/lib/judge';

type PenetrationTableProps = {
  weeks: readonly WeekShare[];
  repository: string | null;
};

export function PenetrationTable({ weeks, repository }: PenetrationTableProps) {
  const counted = (
    week: WeekShare,
    count: number,
    author?: 'spotlight' | 'touched' | 'bots',
  ) =>
    count > 0 ? (
      <InsightsLink
        tab="productivity"
        filter={weekFilter(week.week, repository, author)}
      >
        {formatCount(count)}
      </InsightsLink>
    ) : (
      formatCount(count)
    );

  const columns: InsightsColumn<WeekShare>[] = [
    {
      id: 'week',
      header: 'Week of',
      cell: (week) => formatDay(week.week),
    },
    {
      id: 'merged',
      header: 'Merged',
      numeric: true,
      cell: (week) => counted(week, week.merged),
    },
    {
      id: 'made',
      header: 'Made by Spotlight',
      numeric: true,
      cell: (week) => counted(week, week.made, 'spotlight'),
    },
    {
      id: 'touched',
      header: 'Reviewed by Spotlight',
      numeric: true,
      cell: (week) => counted(week, week.touched, 'touched'),
    },
    {
      id: 'bots',
      header: 'Bots alone',
      numeric: true,
      cell: (week) => counted(week, week.bots, 'bots'),
    },
    {
      id: 'share',
      header: 'Share',
      numeric: true,
      cell: (week) => formatShare(week.share),
    },
  ];

  return (
    <InsightsTable
      label="Merged pull requests by week"
      columns={columns}
      rows={weeks}
      rowKey={(week) => week.week}
    />
  );
}
