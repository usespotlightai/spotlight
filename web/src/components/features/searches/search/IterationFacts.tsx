import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { SearchIterationResponseDto } from '@/lib/api';
import { spendShown } from '@/lib/insights';
import type { ReplayedStation } from '@/lib/replay';
import { runPath } from '@/lib/run';
import { iterationStateShown, REFLECTION_KIND } from '@/lib/search-words';

type IterationFactsProps = {
  at: ReplayedStation;
  iteration: SearchIterationResponseDto;
};

export function IterationFacts({ at, iteration }: IterationFactsProps) {
  const spent = iteration.agentSpent;
  const reflects = iteration.kind === 'reflect';

  return (
    <>
      {reflects && <span className="text-foreground">· {REFLECTION_KIND}</span>}
      <span className="text-muted-foreground">
        · {iterationStateShown(iteration.state)}
      </span>
      {!reflects && (
        <span className="text-muted-foreground tabular-nums">
          · {iteration.proposed.length} of {iteration.attempts}{' '}
          {iteration.attempts === 1 ? 'proposal' : 'proposals'} taken
        </span>
      )}
      {spent && spent.spends.length > 0 && (
        <span className="text-muted-foreground tabular-nums">
          · agent spent {spent.spends.map(spendShown).join(' · ')}
        </span>
      )}
      <TrailLink
        to={runPath(at.slug, at.teamId, iteration.runId)}
        className="text-foreground underline-offset-2 hover:underline sm:ml-auto"
      >
        Agent run
      </TrailLink>
    </>
  );
}
