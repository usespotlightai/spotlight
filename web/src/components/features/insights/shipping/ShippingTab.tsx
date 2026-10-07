import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { NoPullRequests } from '@/components/features/insights/pull-requests/NoPullRequests';
import { ShippingPanels } from '@/components/features/insights/shipping/ShippingPanels';
import { ShippingSkeleton } from '@/components/features/insights/shipping/ShippingSkeleton';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { useInsightsShipping } from '@/hooks/api/useInsightsShipping';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { PULL_REQUESTS_TRUNCATED } from '@/lib/insights-pull-requests';
import { shippingOf } from '@/lib/insights-shipping';
import { failed, loading } from '@/lib/query';

type ShippingTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

const FIRST_SECTION = 'What the agents ship';

export function ShippingTab({ slug, teamId, period, names }: ShippingTabProps) {
  const insights = useInsightsShipping(teamId, period);

  if (loading(insights)) {
    return (
      <InsightsSection title={FIRST_SECTION}>
        <ShippingSkeleton />
      </InsightsSection>
    );
  }

  if (failed(insights) || !insights.data) {
    return (
      <InsightsSection title={FIRST_SECTION}>
        <InsightsFailed what="What the agents ship" query={insights} />
      </InsightsSection>
    );
  }

  if (!insights.data.shippedAny) {
    return (
      <InsightsSection title={FIRST_SECTION}>
        <NoPullRequests slug={slug} teamId={teamId} />
      </InsightsSection>
    );
  }

  return (
    <ShippingPanels
      shipping={shippingOf(insights.data, names)}
      note={
        insights.data.truncated && (
          <TruncatedNote said={PULL_REQUESTS_TRUNCATED} />
        )
      }
    />
  );
}
