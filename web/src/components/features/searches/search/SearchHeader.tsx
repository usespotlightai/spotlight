import { CeilingBar } from '@/components/features/replays/CeilingBar';
import { ScoredRate } from '@/components/features/replays/ScoredRate';
import { SearchStatePill } from '@/components/features/searches/SearchStatePill';
import { StopSearchButton } from '@/components/features/searches/search/StopSearchButton';
import { BestCandidate } from '@/components/features/searches/station/BestCandidate';
import { Noted } from '@/components/shared/Noted';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { spendShown } from '@/lib/insights';
import {
  type ReplayedStation,
  replaySetPath,
  spendOfCeiling,
} from '@/lib/replay';
import { minGainSentence, repeatsShown } from '@/lib/replay-words';
import { since } from '@/lib/runner';
import {
  iterationsShown,
  ongoing,
  type SearchDetail,
  searchLabel,
} from '@/lib/search';
import {
  bestTermShown,
  endingShown,
  OBJECTIVE_TERM,
  objectiveNote,
  objectiveShown,
} from '@/lib/search-words';

type SearchHeaderProps = {
  at: ReplayedStation;
  search: SearchDetail;
  number: number | null;
  setName: string | null;
};

const TERM = 'text-muted-foreground text-xs';
const VALUE = 'text-foreground text-xs tabular-nums';

export function SearchHeader({
  at,
  search,
  number,
  setName,
}: SearchHeaderProps) {
  const { data: harnesses } = useHarnesses();
  const { budget, agent } = search;
  const harness =
    harnesses?.find((each) => each.id === agent.harness)?.name ?? agent.harness;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <h1 className="min-w-0 break-words font-semibold text-2xl text-foreground leading-8 tracking-tight">
          {searchLabel(number)}
        </h1>
        <SearchStatePill
          state={search.state}
          ending={search.ending}
          className="mt-1"
        />
        {ongoing(search.state) && (
          <StopSearchButton
            teamId={at.teamId}
            searchId={search.id}
            className="ml-auto"
          />
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
        <span>
          Searches on{' '}
          <TrailLink
            to={replaySetPath(at, search.setId)}
            className="text-foreground underline-offset-2 hover:underline"
          >
            {setName ?? 'its replay set'}
          </TrailLink>
        </span>
        <span>· started {since(search.startedAt)}</span>
        {search.endedAt && <span>· ended {since(search.endedAt)}</span>}
      </p>

      {search.ending && (
        <p role="note" className="text-muted-foreground text-sm">
          {endingShown(search.ending)}.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
        <dt className={TERM}>Budget</dt>
        <dd className={VALUE}>
          {budget.iterations}{' '}
          {budget.iterations === 1 ? 'iteration' : 'iterations'} ·{' '}
          {budget.perIteration}{' '}
          {budget.perIteration === 1 ? 'candidate' : 'candidates'} each · up to{' '}
          {spendShown(budget.ceiling)} · {budget.concurrency} at once ·{' '}
          {repeatsShown(budget.repeats).toLowerCase()}
        </dd>

        <dt className={TERM}>Live config</dt>
        <dd className={VALUE}>
          <ScoredRate
            rate={search.seed.searchScore}
            interval={search.seed.searchInterval}
            scored={search.seed.searchScored}
          />
          <span className="text-muted-foreground">
            {' '}
            · {minGainSentence(search.minGain)}
          </span>
        </dd>

        <dt className={TERM}>Agent</dt>
        <dd className={VALUE}>
          {[harness, agent.model, agent.effort].filter(Boolean).join(' · ')}
        </dd>

        <dt className={TERM}>Progress</dt>
        <dd className={VALUE}>
          {iterationsShown(search)} · {search.proposed}{' '}
          {search.proposed === 1 ? 'candidate' : 'candidates'} proposed
        </dd>

        <dt className={TERM}>Spent</dt>
        <dd className="flex items-center gap-2 text-xs">
          <span className="text-foreground tabular-nums">
            {spendOfCeiling(search.spent, budget.ceiling)}
          </span>
          <CeilingBar spent={search.spent} ceiling={budget.ceiling} />
        </dd>

        <dt className={TERM}>{OBJECTIVE_TERM}</dt>
        <dd data-slot="search-objective" className={VALUE}>
          <Noted note={objectiveNote(search.objective)}>
            <span>{objectiveShown(search.objective)}</span>
          </Noted>
        </dd>

        <dt className={TERM}>{bestTermShown(search.objective)}</dt>
        <dd>
          <BestCandidate
            best={search.best}
            objective={search.objective}
            labelled={false}
          />
        </dd>
      </dl>
    </div>
  );
}
