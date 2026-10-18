import { FlaskConical } from 'lucide-react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StateBox } from '@/components/features/replays/StateBox';
import { CandidateTableRow } from '@/components/features/searches/search/CandidateTableRow';
import { IterationGroup } from '@/components/features/searches/search/IterationGroup';
import { IterationRow } from '@/components/features/searches/search/IterationRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import {
  byIteration,
  SEARCH_CANDIDATE_HEADINGS,
  type SearchCandidate,
  type SearchDetail,
} from '@/lib/search';
import { CANDIDATES_NOTE } from '@/lib/search-words';
import { cn } from '@/lib/utils';

type SearchCandidatesProps = {
  at: ReplayedStation;
  search: SearchDetail;
  picked: string | null;
  onPick: (candidateId: string) => void;
};

export function SearchCandidates({
  at,
  search,
  picked,
  onPick,
}: SearchCandidatesProps) {
  const groups = byIteration(search);
  const currency = search.budget.ceiling.currency;
  const row = (candidate: SearchCandidate) => (
    <CandidateTableRow
      key={candidate.candidateId}
      candidate={candidate}
      currency={currency}
      picked={picked === candidate.candidateId}
      onPick={() => onPick(candidate.candidateId)}
    />
  );

  return (
    <InsightsCard tableOnly title="Candidates" description={CANDIDATES_NOTE}>
      <NestedTable
        label="Candidates by iteration"
        headings={SEARCH_CANDIDATE_HEADINGS}
        compact
      >
        <IterationRow at={at} title="Started from" iteration={null} />
        {row(search.seed)}

        {groups.map((group) => (
          <IterationGroup key={group.number} at={at} group={group}>
            {group.candidates.map(row)}
          </IterationGroup>
        ))}
      </NestedTable>

      {groups.length === 0 && (
        <StateBox flat>
          <EmptyState
            icon={FlaskConical}
            title="No candidates yet"
            action={
              <TrailLink
                to={replayPath(at, search.seed.replayId)}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'rounded-full bg-card shadow-none',
                )}
              >
                Watch the live config’s replay
              </TrailLink>
            }
          >
            {search.state === 'seeding'
              ? 'The live config replays first. The search agent proposes candidates after that replay finishes.'
              : search.stopReason === 'seed-failed'
                ? 'Spotlight couldn’t replay the live config. The search agent never ran.'
                : 'The search agent proposed no candidates.'}
          </EmptyState>
        </StateBox>
      )}
    </InsightsCard>
  );
}
