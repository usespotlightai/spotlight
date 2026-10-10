import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SignalRow } from '@/components/features/insights/SignalRow';
import { ImproveCardSkeleton } from '@/components/features/stations/improve/ImproveCardSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import {
  DEFAULT_PERIOD,
  type SignalReading,
  signalHeadings,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

const HEADINGS = signalHeadings('edge');

type WorthImprovingProps = {
  teamId: string;
  stationId: string;
  action: ReactNode;
  askAbout: (reading: SignalReading) => ReactNode;
};

export function WorthImproving({
  teamId,
  stationId,
  action,
  askAbout,
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
      description="What got worse over the last 30 days, or trails the rest of the team. The team’s agent reads this, the config and recent runs, and suggests what to change."
    >
      {failed(overview) ? (
        <p className="pb-1 text-muted-foreground text-sm">
          The station’s signals could not be loaded.
        </p>
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
              action={askAbout(reading)}
            />
          ))}
        </NestedTable>
      ) : (
        <div className="flex justify-center pt-2 pb-10">
          <EmptyState
            icon={CircleCheck}
            title="Every signal looks healthy over the last 30 days"
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
