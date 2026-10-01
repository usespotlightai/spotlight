import { DeliveryStages } from '@/components/features/insights/DeliveryStages';
import { FlowSkeleton } from '@/components/features/insights/FlowSkeleton';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { StationWaits } from '@/components/features/insights/StationWaits';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { useInsightsFlow } from '@/hooks/api/useInsightsFlow';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type FlowTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function FlowTab({ slug, teamId, period, names }: FlowTabProps) {
  const flow = useInsightsFlow(teamId, period);

  if (loading(flow)) {
    return <FlowSkeleton />;
  }

  if (failed(flow) || !flow.data) {
    return <InsightsFailed what="The flow" query={flow} />;
  }

  const { flow: now, before, truncated } = flow.data;

  if (
    now.stations.length === 0 &&
    now.delivery.opened === 0 &&
    now.delivery.merged === 0
  ) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Once tasks move through the stations, where they wait shows here.
      </NoRunsInPeriod>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {truncated && <TruncatedNote />}

      {now.stations.length > 0 && (
        <StationWaits
          slug={slug}
          teamId={teamId}
          stations={now.stations}
          before={before.stations}
          names={names}
        />
      )}

      <DeliveryStages delivery={now.delivery} before={before.delivery} />
    </div>
  );
}
