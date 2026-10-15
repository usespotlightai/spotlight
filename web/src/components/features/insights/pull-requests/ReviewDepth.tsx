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
        tab="productivity"
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
      tableOnly
      title="Review depth"
      description="Review rounds per merged pull request. A person’s approval or change request is a round. Comments after the last round add one more round. Dismissed reviews don’t count."
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
