import { CardList } from '@/components/features/replays/CardList';
import { IterationFacts } from '@/components/features/searches/search/IterationFacts';
import { IterationReflection } from '@/components/features/searches/search/IterationReflection';
import { NothingProposed } from '@/components/features/searches/search/NothingProposed';
import { SearchCandidateRow } from '@/components/features/searches/search/SearchCandidateRow';
import type { ReplayedStation } from '@/lib/replay';
import type { IterationGroup as Group } from '@/lib/search';

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

  return (
    <div
      data-slot="iteration"
      data-kind={iteration?.kind}
      className="flex flex-col gap-1.5"
    >
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className="font-medium text-foreground">
          Iteration {group.number}
        </span>
        {iteration && <IterationFacts at={at} iteration={iteration} />}
      </p>

      {iteration?.kind === 'reflect' ? (
        <IterationReflection iteration={iteration} />
      ) : candidates.length > 0 ? (
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
        <NothingProposed iteration={iteration} />
      )}
    </div>
  );
}
