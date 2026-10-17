import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { NoPullRequests } from '@/components/features/insights/pull-requests/NoPullRequests';
import { Penetration } from '@/components/features/insights/pull-requests/Penetration';
import { PullRequestList } from '@/components/features/insights/pull-requests/PullRequestList';
import { PullRequestsSkeleton } from '@/components/features/insights/pull-requests/PullRequestsSkeleton';
import { PullRequestTypes } from '@/components/features/insights/pull-requests/PullRequestTypes';
import { RepositoryPenetration } from '@/components/features/insights/pull-requests/RepositoryPenetration';
import { ReviewDepth } from '@/components/features/insights/pull-requests/ReviewDepth';
import { SpotlightAgainstPeople } from '@/components/features/insights/pull-requests/SpotlightAgainstPeople';
import { useInsightsPullRequests } from '@/hooks/api/useInsightsPullRequests';
import type { InsightsView } from '@/lib/insights';
import { pullRequestsNarrowedBy } from '@/lib/insights-pull-requests';
import { failed, loading } from '@/lib/query';

type PullRequestsTabProps = {
  slug: string;
  teamId: string;
  view: InsightsView;
  onView: (view: InsightsView) => void;
};

export function PullRequestsTab({
  slug,
  teamId,
  view,
  onView,
}: PullRequestsTabProps) {
  const insights = useInsightsPullRequests(teamId, view.period);

  if (loading(insights)) {
    return <PullRequestsSkeleton view={view} onView={onView} />;
  }

  if (failed(insights) || !insights.data) {
    return <InsightsFailed what="The pull requests" query={insights} />;
  }

  const { penetration, comparison, types, depth, weeks, total } = insights.data;
  const narrowed = pullRequestsNarrowedBy(view.filter).length > 0;

  if (total === 0 && !narrowed && view.page === 1) {
    return <NoPullRequests slug={slug} teamId={teamId} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Penetration penetration={penetration} />

      <RepositoryPenetration
        weeks={weeks}
        repositories={penetration.repositories}
      />

      <SpotlightAgainstPeople comparison={comparison} />

      <PullRequestTypes types={types} />

      <ReviewDepth depth={depth} repositories={comparison.repositories} />

      <PullRequestList
        slug={slug}
        teamId={teamId}
        view={view}
        repositories={penetration.repositories.map((each) => each.repository)}
        onView={onView}
      />
    </div>
  );
}
