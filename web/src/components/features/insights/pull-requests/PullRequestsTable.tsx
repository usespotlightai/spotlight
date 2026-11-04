import { ExternalLink } from 'lucide-react';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { formatCount, formatDurationOrNone, formatSpend } from '@/lib/insights';
import {
  formatAuthor,
  formatSize,
  formatState,
  formatType,
  type InsightsPullRequest,
} from '@/lib/insights-pull-requests';
import { since } from '@/lib/since';
import { taskPath } from '@/lib/task';

type PullRequestsTableProps = {
  slug: string;
  teamId: string;
  pullRequests: readonly InsightsPullRequest[];
};

export function PullRequestsTable({
  slug,
  teamId,
  pullRequests,
}: PullRequestsTableProps) {
  const writtenBy = (pullRequest: InsightsPullRequest) => {
    if (pullRequest.by === 'spotlight' && pullRequest.taskId) {
      return (
        <span className="flex items-center gap-2">
          <TrailLink
            to={taskPath(slug, teamId, pullRequest.taskId)}
            className="hover:underline"
          >
            {formatAuthor('spotlight')}
          </TrailLink>
          <InsightsLink
            tab="traces"
            filter={{ taskId: pullRequest.taskId }}
            className="text-muted-foreground"
          >
            Runs
          </InsightsLink>
        </span>
      );
    }

    const reviewTask = pullRequest.reviewTaskIds[0];

    return (
      <span className="flex items-center gap-2">
        {pullRequest.author ?? 'Someone'}
        {reviewTask && (
          <TrailLink
            to={taskPath(slug, teamId, reviewTask)}
            className="text-muted-foreground hover:underline"
          >
            Spotlight review
          </TrailLink>
        )}
      </span>
    );
  };

  const columns: InsightsColumn<InsightsPullRequest>[] = [
    {
      id: 'pull-request',
      header: 'Pull request',
      size: 'minmax(18rem,1fr)',
      cell: (pullRequest) => (
        <a
          href={pullRequest.pullRequest}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-1 hover:underline"
          title={pullRequest.title}
        >
          <span className="truncate">{pullRequest.title}</span>
          <span className="shrink-0 text-muted-foreground">
            #{pullRequest.number}
          </span>
          <ExternalLink aria-hidden className="size-3 shrink-0" />
        </a>
      ),
    },
    {
      id: 'repository',
      header: 'Repository',
      size: 'max-content',
      cell: (pullRequest) => pullRequest.repository,
    },
    { id: 'by', header: 'Written by', size: 'max-content', cell: writtenBy },
    {
      id: 'type',
      header: 'Type',
      size: 'max-content',
      cell: (pullRequest) => formatType(pullRequest.type),
    },
    {
      id: 'state',
      header: 'State',
      size: 'max-content',
      cell: (pullRequest) =>
        pullRequest.reverted
          ? `${formatState(pullRequest.state)}, reverted`
          : formatState(pullRequest.state),
    },
    {
      id: 'opened',
      header: 'Opened',
      size: 'max-content',
      numeric: true,
      cell: (pullRequest) => since(pullRequest.openedAt),
    },
    {
      id: 'to-merge',
      header: 'To merge',
      size: 'max-content',
      numeric: true,
      cell: (pullRequest) => formatDurationOrNone(pullRequest.toMergeMs),
    },
    {
      id: 'in-review',
      header: 'In review',
      size: 'max-content',
      numeric: true,
      cell: (pullRequest) => formatDurationOrNone(pullRequest.inReviewMs),
    },
    {
      id: 'rounds',
      header: 'Rounds',
      size: 'max-content',
      numeric: true,
      cell: (pullRequest) => formatCount(pullRequest.reviewRounds),
    },
    {
      id: 'comments',
      header: 'Comments',
      size: 'max-content',
      numeric: true,
      cell: (pullRequest) => formatCount(pullRequest.reviewComments),
    },
    {
      id: 'size',
      header: 'Size',
      size: 'max-content',
      numeric: true,
      cell: formatSize,
    },
    {
      id: 'cost',
      header: 'Cost',
      size: 'max-content',
      numeric: true,
      cell: (pullRequest) =>
        pullRequest.by === 'spotlight' ? formatSpend(pullRequest.spend) : '–',
    },
  ];

  return (
    <InsightsTable
      label="Pull requests"
      columns={columns}
      rows={pullRequests}
      rowKey={(pullRequest) => pullRequest.pullRequest}
    />
  );
}
