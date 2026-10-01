import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown } from '@/lib/insights';
import {
  groupFilter,
  type RoundsShare,
  roundsShown,
} from '@/lib/insights-pull-requests';

type ReviewDepthProps = {
  depth: readonly RoundsShare[];
  repositories: readonly string[];
};

export function ReviewDepth({ depth, repositories }: ReviewDepthProps) {
  const counted = (share: RoundsShare, author: 'spotlight' | 'people') =>
    share[author] > 0 ? (
      <InsightsLink
        tab="pull-requests"
        filter={groupFilter(author, repositories, { rounds: share.rounds })}
      >
        {countShown(share[author])}
      </InsightsLink>
    ) : (
      countShown(0)
    );

  const columns: InsightsColumn<RoundsShare>[] = [
    {
      id: 'rounds',
      header: 'Review rounds',
      cell: (share) => roundsShown(share.rounds),
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
      title="Review depth"
      description="How many rounds of review merged pull requests took. Each approval or request for changes by a person is a round, and comments after the last of them make one more; dismissed reviews do not count."
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
