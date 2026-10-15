import { IterationNote } from '@/components/features/searches/search/IterationNote';
import type { SearchIterationResponseDto } from '@/lib/api';

type NothingProposedProps = {
  iteration: SearchIterationResponseDto | null;
};

export function NothingProposed({ iteration }: NothingProposedProps) {
  return (
    <IterationNote>
      {iteration?.state === 'wanted' || iteration?.state === 'running'
        ? 'Nothing proposed yet.'
        : 'The search agent proposed nothing replayable.'}
    </IterationNote>
  );
}
