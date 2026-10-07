import type { SearchIterationResponseDto } from '@/lib/api';

type NothingProposedProps = {
  iteration: SearchIterationResponseDto | null;
};

export function NothingProposed({ iteration }: NothingProposedProps) {
  return (
    <p className="rounded-xl border border-border px-3 py-2 text-muted-foreground text-xs">
      {iteration?.state === 'wanted' || iteration?.state === 'running'
        ? 'Nothing proposed yet.'
        : 'Search agent proposed nothing replayable.'}
    </p>
  );
}
