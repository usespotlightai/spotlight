import { FlowTab } from '@/components/features/insights/FlowTab';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { OVERVIEW_LAYOUT } from '@/components/features/insights/overview-layout';
import { ProductivitySkeleton } from '@/components/features/insights/ProductivitySkeleton';
import { PullRequestsTab } from '@/components/features/insights/pull-requests/PullRequestsTab';
import { ShippingTab } from '@/components/features/insights/shipping/ShippingTab';
import { useInsightsFlow } from '@/hooks/api/useInsightsFlow';
import { useInsightsPullRequestList } from '@/hooks/api/useInsightsPullRequestList';
import { useInsightsPullRequests } from '@/hooks/api/useInsightsPullRequests';
import { useInsightsShipping } from '@/hooks/api/useInsightsShipping';
import type { InsightsView, StationNames } from '@/lib/insights';
import { loading } from '@/lib/query';

type ProductivityTabProps = {
  slug: string;
  teamId: string;
  view: InsightsView;
  names: StationNames;
  onView: (view: InsightsView) => void;
};

export function ProductivityTab({
  slug,
  teamId,
  view,
  names,
  onView,
}: ProductivityTabProps) {
  const queries = [
    useInsightsFlow(teamId, view.period),
    useInsightsShipping(teamId, view.period),
    useInsightsPullRequests(teamId, view.period),
    useInsightsPullRequestList(teamId, view.period, view.filter, view.page),
  ];

  if (queries.some(loading)) {
    return <ProductivitySkeleton view={view} names={names} onView={onView} />;
  }

  return (
    <div className={OVERVIEW_LAYOUT}>
      <InsightsSection collapsible={false} title="Where work waits">
        <FlowTab
          slug={slug}
          teamId={teamId}
          period={view.period}
          names={names}
        />
      </InsightsSection>

      <ShippingTab
        slug={slug}
        teamId={teamId}
        period={view.period}
        names={names}
      />

      <InsightsSection collapsible={false} title="Pull requests">
        <PullRequestsTab
          slug={slug}
          teamId={teamId}
          view={view}
          onView={onView}
        />
      </InsightsSection>
    </div>
  );
}
