import { SectionLink } from '@/components/shared/SectionLink';
import type { SearchIterationResponseDto } from '@/lib/api';
import type { ReplayedStation } from '@/lib/replay';
import { runPath } from '@/lib/run';
import { formatIterationState, REFLECTION_KIND } from '@/lib/search-words';

type IterationFactsProps = {
  at: ReplayedStation;
  iteration: SearchIterationResponseDto;
};

export function IterationFacts({ at, iteration }: IterationFactsProps) {
  return (
    <>
      {iteration.kind === 'reflect' && (
        <span className="text-foreground">· {REFLECTION_KIND}</span>
      )}
      {iteration.state !== 'ended' && (
        <span className="text-muted-foreground">
          · {formatIterationState(iteration.state)}
        </span>
      )}
      <SectionLink
        to={runPath(at.slug, at.teamId, iteration.runId)}
        className="relative z-10 sm:ml-auto"
      >
        Agent run
      </SectionLink>
    </>
  );
}
