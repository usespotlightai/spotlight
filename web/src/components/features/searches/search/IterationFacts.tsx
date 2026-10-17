import { TrailLink } from '@/components/shell/layout/TrailLink';
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
      <TrailLink
        to={runPath(at.slug, at.teamId, iteration.runId)}
        className="relative z-10 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:ml-auto"
      >
        Agent run
      </TrailLink>
    </>
  );
}
