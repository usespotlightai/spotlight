import { FlaskConical } from 'lucide-react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { StateBox } from '@/components/features/replays/StateBox';
import { IterationGroup } from '@/components/features/searches/search/IterationGroup';
import { SearchCandidateRow } from '@/components/features/searches/search/SearchCandidateRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import { byIteration, type SearchDetail } from '@/lib/search';
import { cn } from '@/lib/utils';

type SearchCandidatesProps = {
  at: ReplayedStation;
  search: SearchDetail;
};

export function SearchCandidates({ at, search }: SearchCandidatesProps) {
  const groups = byIteration(search);
  const currency = search.budget.ceiling.currency;

  return (
    <section aria-labelledby="candidates" className="flex flex-col gap-3">
      <ReplaysHeading title="Candidates" id="candidates" level="h2" />

      <div className="flex flex-col gap-1.5">
        <p className="font-medium text-foreground text-xs">Started from</p>
        <CardList label="Where it started">
          <SearchCandidateRow
            at={at}
            searchId={search.id}
            candidate={search.seed}
            currency={currency}
          />
        </CardList>
      </div>

      {groups.length === 0 ? (
        <StateBox>
          <EmptyState
            icon={FlaskConical}
            title="No candidates yet"
            action={
              <TrailLink
                to={replayPath(at, search.seed.replayId)}
                className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
              >
                Watch the live config’s replay
              </TrailLink>
            }
          >
            {search.state === 'seeding'
              ? 'The live config is replayed first. Its agent starts proposing candidates once that replay finishes.'
              : search.ending === 'seed-failed'
                ? 'The live config could not be replayed, so its agent never ran.'
                : 'Its agent proposed no candidates.'}
          </EmptyState>
        </StateBox>
      ) : (
        groups.map((group) => (
          <IterationGroup
            key={group.number}
            at={at}
            searchId={search.id}
            group={group}
            currency={currency}
          />
        ))
      )}
    </section>
  );
}
