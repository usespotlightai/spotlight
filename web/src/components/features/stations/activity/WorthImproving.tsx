import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { SignalDumbbell } from '@/components/features/insights/SignalDumbbell';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TABLE_HEAD, TABLE_ROW } from '@/components/shared/table-rows';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import {
  DEFAULT_PERIOD,
  formatSignal,
  type SignalReading,
  signalLabel,
  signalValue,
  WORTH_IMPROVING_SPAN,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';
import { cn } from '@/lib/utils';

const COLUMNS =
  'grid-cols-[minmax(7rem,1fr)_minmax(9rem,1.6fr)_repeat(4,5.5rem)_8.5rem]';

const COMPARED = [
  { id: 'now', heading: 'This period' },
  { id: 'before', heading: 'Period before' },
  { id: 'team', heading: 'All stations' },
  { id: 'flaggedAbove', heading: 'Flagged above' },
] as const;

type WorthImprovingProps = {
  teamId: string;
  stationId: string;
  action: ReactNode;
  actionFor: (reading: SignalReading) => ReactNode;
};

function SignalsHead() {
  return (
    <div aria-hidden className={cn(TABLE_HEAD, COLUMNS)}>
      <span className="truncate">Signal</span>
      <span className="truncate">Compared</span>
      {COMPARED.map(({ id, heading }) => (
        <span key={id} className="truncate text-right">
          {heading}
        </span>
      ))}
      <span />
    </div>
  );
}

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
      <div
        role="status"
        aria-label="Loading the station’s signals"
        className="-mx-3"
      >
        <SignalsHead />
        <div className={cn(TABLE_ROW, COLUMNS)}>
          <SkeletonLine className="w-20" />
          <SkeletonLine className="w-full" />
        </div>
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
      <div
        data-slot="signals-healthy"
        className="flex items-center justify-between gap-4 text-sm"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CircleCheck
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="text-foreground">All signals are healthy</span>
          <span className="truncate text-muted-foreground">
            No issues in the {WORTH_IMPROVING_SPAN}.
          </span>
        </span>
        {action}
      </div>
    );
  }

  return (
    <div className="-mx-3 overflow-x-auto [scrollbar-width:none]">
      <div className="min-w-[46rem]">
        <SignalsHead />
        <ul aria-label="Signals worth improving">
          {flagged.signals.map((reading) => (
            <li
              key={reading.signal}
              data-slot="signal-reading"
              className={cn(TABLE_ROW, COLUMNS)}
            >
              <span className="truncate text-foreground">
                {signalLabel(reading.signal)}
              </span>
              <div role="img" aria-label={formatSignal(reading)}>
                <SignalDumbbell reading={reading} />
              </div>
              {COMPARED.map(({ id }) => (
                <span
                  key={id}
                  className={cn(
                    'truncate text-right tabular-nums',
                    id === 'now' ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {signalValue(reading, reading[id])}
                </span>
              ))}
              <span className="flex justify-end">{actionFor(reading)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
