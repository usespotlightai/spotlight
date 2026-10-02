import { CardList } from '@/components/features/replays/CardList';
import { SearchCandidateRow } from '@/components/features/searches/search/SearchCandidateRow';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { spendShown } from '@/lib/insights';
import type { ReplayedStation } from '@/lib/replay';
import { runPath } from '@/lib/run';
import type { IterationGroup as Group } from '@/lib/search';
import { iterationStateShown } from '@/lib/search-words';

type IterationGroupProps = {
  at: ReplayedStation;
  searchId: string;
  group: Group;
  currency: string;
};

export function IterationGroup({
  at,
  searchId,
  group,
  currency,
}: IterationGroupProps) {
  const { iteration, candidates } = group;
  const spent = iteration?.agentSpent;

  return (
    <div data-slot="iteration" className="flex flex-col gap-1.5">
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className="font-medium text-foreground">
          Iteration {group.number}
        </span>
        {iteration && (
          <>
            <span className="text-muted-foreground">
              · {iterationStateShown(iteration.state)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              · {iteration.proposed.length} of {iteration.attempts}{' '}
              {iteration.attempts === 1 ? 'proposal' : 'proposals'} taken
            </span>
            {spent && spent.spends.length > 0 && (
              <span className="text-muted-foreground tabular-nums">
                · its agent spent {spent.spends.map(spendShown).join(' · ')}
              </span>
            )}
            <TrailLink
              to={runPath(at.slug, at.teamId, iteration.runId)}
              className="text-foreground underline-offset-2 hover:underline sm:ml-auto"
            >
              Its agent’s run
            </TrailLink>
          </>
        )}
      </p>

      {candidates.length > 0 ? (
        <CardList label={`Candidates of iteration ${group.number}`}>
          {candidates.map((candidate) => (
            <SearchCandidateRow
              key={candidate.candidateId}
              at={at}
              searchId={searchId}
              candidate={candidate}
              currency={currency}
            />
          ))}
        </CardList>
      ) : (
        <p className="rounded-xl border border-border px-3 py-2 text-muted-foreground text-xs">
          {iteration?.state === 'wanted' || iteration?.state === 'running'
            ? 'Its agent has not proposed anything yet.'
            : 'Its agent proposed nothing that could be replayed.'}
        </p>
      )}
    </div>
  );
}
