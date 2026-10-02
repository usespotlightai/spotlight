import type { SearchBestResponseDto } from '@/lib/api';
import { scoreShown } from '@/lib/search';
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
      {labelled && <span className="text-muted-foreground">Best:</span>}
      <span className="truncate text-foreground">
        {best.seed ? 'Live config' : best.name}
      </span>
      <span className="text-muted-foreground tabular-nums">
        · {scoreShown(heldOut ? best.heldOutScore : best.searchScore)}{' '}
        {heldOut ? 'held out' : 'searched'}
      </span>
    </span>
  );
}
