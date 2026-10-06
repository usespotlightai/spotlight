import { FlowTab } from '@/components/features/insights/FlowTab';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { PullRequestsTab } from '@/components/features/insights/pull-requests/PullRequestsTab';
import { ShippingTab } from '@/components/features/insights/shipping/ShippingTab';
import type { InsightsView, StationNames } from '@/lib/insights';

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
  return (
    <>
      <InsightsSection title="Where work waits">
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

      <InsightsSection title="Pull requests">
        <PullRequestsTab
          slug={slug}
          teamId={teamId}
          view={view}
          onView={onView}
        />
      </InsightsSection>
    </>
  );
}
