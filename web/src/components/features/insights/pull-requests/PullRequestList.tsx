import { useEffect, useRef } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsPager } from '@/components/features/insights/InsightsPager';
import { PullRequestFilters } from '@/components/features/insights/pull-requests/PullRequestFilters';
import { PullRequestListSkeleton } from '@/components/features/insights/pull-requests/PullRequestListSkeleton';
import { PullRequestsTable } from '@/components/features/insights/pull-requests/PullRequestsTable';
import { Button } from '@/components/ui/button';
import { useInsightsPullRequestList } from '@/hooks/api/useInsightsPullRequestList';
import { type InsightsView, lastPageOf, pageShownOf } from '@/lib/insights';
import {
  PULL_REQUESTS_LIST_ID,
  pullRequestsNarrowedBy,
} from '@/lib/insights-pull-requests';
import { failed, loading } from '@/lib/query';

type PullRequestListProps = {
  slug: string;
  teamId: string;
  view: InsightsView;
  repositories: readonly string[];
  onView: (view: InsightsView) => void;
};

export function PullRequestList({
  slug,
  teamId,
  view,
  repositories,
  onView,
}: PullRequestListProps) {
  const list = useInsightsPullRequestList(
    teamId,
    view.period,
    view.filter,
    view.page,
  );
  const narrowed = pullRequestsNarrowedBy(view.filter);
  const narrowing = narrowed
    .map((key) => `${key}=${view.filter[key]}`)
    .join('&');
  const here = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (narrowing) {
      here.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [narrowing]);

  return (
    <div ref={here} id={PULL_REQUESTS_LIST_ID} className="scroll-mt-4">
      <InsightsCard
        title="Pull requests"
        description="Pull requests in the team’s repositories: opened or closed this period, or still open. Latest first."
      >
        <div className="flex flex-col gap-3">
          <PullRequestFilters
            filter={view.filter}
            repositories={repositories}
            onChange={(filter) => onView({ ...view, filter, page: 1 })}
          />

          {loading(list) ? (
            <PullRequestListSkeleton />
          ) : failed(list) || !list.data ? (
            <InsightsFailed what="The pull requests" query={list} />
          ) : list.data.total === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-muted-foreground text-sm">
                {narrowed.length > 0
                  ? 'No pull requests match.'
                  : 'No pull requests in this period.'}
              </p>
              {narrowed.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-card"
                  onClick={() => onView({ ...view, filter: {}, page: 1 })}
                >
                  Show every pull request
                </Button>
              )}
            </div>
          ) : (
            <>
              <PullRequestsTable
                slug={slug}
                teamId={teamId}
                pullRequests={list.data.pullRequests}
              />
              <InsightsPager
                label="Pages of pull requests"
                shown={pageShownOf(list.data, 'No pull requests')}
                page={list.data.page}
                lastPage={lastPageOf(list.data)}
                onPage={(page) => onView({ ...view, page })}
              />
            </>
          )}
        </div>
      </InsightsCard>
    </div>
  );
}
