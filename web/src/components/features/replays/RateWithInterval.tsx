import { Noted } from '@/components/shared/Noted';
import { formatPercent } from '@/lib/judge';
import type { RateInterval } from '@/lib/replay';
import { formatInterval, INTERVAL_NOTE } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type RateWithIntervalProps = {
  rate: number | null;
  interval: RateInterval | null;
  className?: string;
};

export function RateWithInterval({
  rate,
  interval,
  className,
}: RateWithIntervalProps) {
  return (
    <span
      data-slot="rate-with-interval"
      className={cn('text-foreground tabular-nums', className)}
    >
      {formatPercent(rate)}
      {rate !== null && interval && (
        <>
          {' '}
          <Noted note={INTERVAL_NOTE}>
            <span data-slot="rate-interval" className="text-muted-foreground">
              ({formatInterval(interval)})
            </span>
          </Noted>
        </>
      )}
    </span>
  );
}
