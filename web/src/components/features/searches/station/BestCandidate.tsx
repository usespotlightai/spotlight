import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import { OnlyOnSeenTasksBadge } from '@/components/features/searches/OnlyOnSeenTasksBadge';
import type { SearchBestResponseDto } from '@/lib/api';
import { BEST_LABEL, bestOnShown } from '@/lib/search-words';
import { cn } from '@/lib/utils';

type BestCandidateProps = {
  best: SearchBestResponseDto | null;
  labelled?: boolean;
  className?: string;
};

export function BestCandidate({
  best,
  labelled = true,
  className,
}: BestCandidateProps) {
  if (!best) {
    return (
      <span className={cn('text-muted-foreground text-xs', className)}>
        No best candidate yet
      </span>
    );
  }

  const heldOut = best.heldOutScore !== null;

  return (
    <span
      data-slot="best-candidate"
      className={cn('flex min-w-0 items-center gap-1.5 text-xs', className)}
    >
      {labelled && <span className="text-muted-foreground">{BEST_LABEL}</span>}
      <span className="truncate text-foreground">
        {best.seed ? 'Live config' : best.name}
      </span>
      <span className="text-muted-foreground tabular-nums">
        ·{' '}
        <RateWithInterval
          rate={heldOut ? best.heldOutScore : best.searchScore}
          interval={heldOut ? best.heldOutInterval : best.searchInterval}
          className="text-muted-foreground"
        />{' '}
        {bestOnShown(heldOut)}
      </span>
      {best.onlyOnSeenTasks && (
        <OnlyOnSeenTasksBadge mark={best.onlyOnSeenTasks} />
      )}
    </span>
  );
}
