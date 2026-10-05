import { ExternalLink } from 'lucide-react';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { countShown, lastedOrNone, spendShown } from '@/lib/insights';
import {
  authorShown,
  type InsightsPullRequest,
  sizeShown,
  stateShown,
  typeShown,
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
            {authorShown('spotlight')}
          </TrailLink>
          <InsightsLink
            tab="runs"
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
      cell: (pullRequest) => (
        <a
          href={pullRequest.pullRequest}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-72 items-center gap-1 hover:underline"
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
      cell: (pullRequest) => pullRequest.repository,
    },
    { id: 'by', header: 'Written by', cell: writtenBy },
    {
      id: 'type',
      header: 'Type',
      cell: (pullRequest) => typeShown(pullRequest.type),
    },
    {
      id: 'state',
      header: 'State',
      cell: (pullRequest) =>
        pullRequest.reverted
          ? `${stateShown(pullRequest.state)}, reverted`
          : stateShown(pullRequest.state),
    },
    {
      id: 'opened',
      header: 'Opened',
      numeric: true,
      cell: (pullRequest) => since(pullRequest.openedAt),
    },
    {
      id: 'to-merge',
      header: 'To merge',
      numeric: true,
      cell: (pullRequest) => lastedOrNone(pullRequest.toMergeMs),
    },
    {
      id: 'in-review',
      header: 'In review',
      numeric: true,
      cell: (pullRequest) => lastedOrNone(pullRequest.inReviewMs),
    },
    {
      id: 'rounds',
      header: 'Rounds',
      numeric: true,
      cell: (pullRequest) => countShown(pullRequest.reviewRounds),
    },
    {
      id: 'comments',
      header: 'Comments',
      numeric: true,
      cell: (pullRequest) => countShown(pullRequest.reviewComments),
    },
    {
      id: 'size',
      header: 'Size',
      numeric: true,
      cell: sizeShown,
    },
    {
      id: 'cost',
      header: 'Cost',
      numeric: true,
      cell: (pullRequest) =>
        pullRequest.by === 'spotlight' ? spendShown(pullRequest.spend) : '–',
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
