import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SignalRow } from '@/components/features/insights/SignalRow';
import { WorthImprovingSkeleton } from '@/components/features/stations/improve/WorthImprovingSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import {
  DEFAULT_PERIOD,
  type SignalReading,
  WORTH_IMPROVING_HEADINGS,
  WORTH_IMPROVING_NOTE,
  WORTH_IMPROVING_SPAN,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type WorthImprovingProps = {
  teamId: string;
  stationId: string;
  action: ReactNode;
  actionFor: (reading: SignalReading) => ReactNode;
};

export function WorthImproving({
  teamId,
  stationId,
  action,
  actionFor,
}: WorthImprovingProps) {
  const overview = useInsightsOverview(teamId, DEFAULT_PERIOD);
  const flagged = overview.data?.worthImproving.find(
    (each) => each.stationId === stationId,
  );

  if (loading(overview)) {
    return <WorthImprovingSkeleton />;
  }

  return (
    <InsightsCard
      tableOnly
      title="Worth improving"
      description={WORTH_IMPROVING_NOTE}
    >
      {failed(overview) ? (
        <CouldNotLoad
          what="The station’s signals"
          retrying={overview.isFetching}
          onRetry={() => void overview.refetch()}
          className="pt-2 pb-10"
        />
      ) : flagged && flagged.signals.length > 0 ? (
        <NestedTable
          label="Signals worth improving"
          headings={WORTH_IMPROVING_HEADINGS}
          compact
          trailing
        >
          {flagged.signals.map((reading) => (
            <SignalRow
              key={reading.signal}
              reading={reading}
              nested={false}
              action={actionFor(reading)}
            />
          ))}
        </NestedTable>
      ) : (
        <div className="flex justify-center pt-2 pb-10">
          <EmptyState
            icon={CircleCheck}
            title="All signals are healthy"
            action={action}
            className="max-w-md"
          >
            No issues detected in the {WORTH_IMPROVING_SPAN}.
          </EmptyState>
        </div>
      )}
    </InsightsCard>
  );
}
