import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SignalRow } from '@/components/features/insights/SignalRow';
import { ImproveCardSkeleton } from '@/components/features/stations/improve/ImproveCardSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import {
  DEFAULT_PERIOD,
  type SignalReading,
  signalHeadings,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { rangeOf } from '@/lib/range';

const HEADINGS = signalHeadings('edge');

const span = rangeOf(DEFAULT_PERIOD).label.toLowerCase();

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
    return (
      <ImproveCardSkeleton
        label="Loading the station’s signals"
        rows={2}
        rowHeight={40}
      />
    );
  }

  return (
    <InsightsCard
      tableOnly
      title="Worth improving"
      description={`Signals that got worse over the ${span}, or that trail the rest of the team. The team’s agent reads these signals, the config and recent runs, and suggests what to change.`}
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
          headings={HEADINGS}
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
            title={`Every signal looks healthy over the ${span}`}
            action={action}
            className="max-w-md"
          >
            There’s always room to improve. Talk it through with the agent.
          </EmptyState>
        </div>
      )}
    </InsightsCard>
  );
}
