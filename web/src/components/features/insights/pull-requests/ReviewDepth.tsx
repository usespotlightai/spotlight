import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { formatCount } from '@/lib/insights';
import {
  formatRounds,
  groupFilter,
  REVIEW_DEPTH_NOTE,
  type RoundsShare,
} from '@/lib/insights-pull-requests';

type ReviewDepthProps = {
  depth: readonly RoundsShare[];
  repositories: readonly string[];
};

export function ReviewDepth({ depth, repositories }: ReviewDepthProps) {
  const counted = (share: RoundsShare, author: 'spotlight' | 'people') =>
    share[author] > 0 ? (
      <InsightsLink
        tab="productivity"
        filter={groupFilter(author, repositories, { rounds: share.rounds })}
      >
        {formatCount(share[author])}
      </InsightsLink>
    ) : (
      formatCount(0)
    );

  const columns: InsightsColumn<RoundsShare>[] = [
    {
      id: 'rounds',
      header: 'Review rounds',
      cell: (share) => formatRounds(share.rounds),
    },
    {
      id: 'spotlight',
      header: 'Spotlight’s',
      numeric: true,
      cell: (share) => counted(share, 'spotlight'),
    },
    {
      id: 'people',
      header: 'People’s alone',
      numeric: true,
      cell: (share) => counted(share, 'people'),
    },
  ];

  return (
    <InsightsCard
      tableOnly
      scrolls
      title="Review depth"
      description={REVIEW_DEPTH_NOTE}
    >
      <InsightsTable
        label="Merged pull requests by review rounds"
        columns={columns}
        rows={depth}
        rowKey={(share) => share.rounds}
      />
    </InsightsCard>
  );
}
