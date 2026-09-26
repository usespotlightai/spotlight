import type { InboxItem } from '@/lib/inbox';
import { cn } from '@/lib/utils';

type FailureCountProps = {
  failure: InboxItem['failure'];
  className?: string;
};

export function FailureCount({ failure, className }: FailureCountProps) {
  if (!failure || failure.occurrences < 2) {
    return null;
  }

  return (
    <span
      title={`Failed ${failure.occurrences} times`}
      className={cn(
        'shrink-0 text-muted-foreground text-xs tabular-nums',
        className,
      )}
    >
      <span aria-hidden>×{failure.occurrences}</span>
      <span className="sr-only">Failed {failure.occurrences} times</span>
    </span>
  );
}
