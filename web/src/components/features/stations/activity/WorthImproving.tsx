import type { ReactNode } from 'react';

import { SignalRow } from '@/components/features/insights/SignalRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { HealthyLine } from '@/components/shared/HealthyLine';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import {
  type InsightsPeriod,
  type SignalReading,
  WORTH_IMPROVING_HEADINGS,
  WORTH_IMPROVING_SPAN,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type WorthImprovingProps = {
  teamId: string;
  stationId: string;
  period: InsightsPeriod;
  action: ReactNode;
  actionFor: (reading: SignalReading) => ReactNode;
};

export function WorthImproving({
  teamId,
  stationId,
  period,
  action,
  actionFor,
}: WorthImprovingProps) {
  const overview = useInsightsOverview(teamId, period);
  const flagged = overview.data?.worthImproving.find(
    (each) => each.stationId === stationId,
  );

  if (loading(overview)) {
    return (
      <div className="-mx-2">
        <NestedTableSkeleton
          label="Loading the station’s signals"
          headings={WORTH_IMPROVING_HEADINGS}
          compact
          trailing
        />
      </div>
    );
  }

  if (failed(overview)) {
    return (
      <CouldNotLoad
        what="The station’s signals"
        retrying={overview.isFetching}
        onRetry={() => void overview.refetch()}
        className="py-6"
      />
    );
  }

  if (!flagged || flagged.signals.length === 0) {
    return (
      <HealthyLine action={action}>
        No issues in the {WORTH_IMPROVING_SPAN}.
      </HealthyLine>
    );
  }

  return (
    <div className="-mx-2">
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
    </div>
  );
}
