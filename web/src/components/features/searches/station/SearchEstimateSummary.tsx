import type { ReactNode } from 'react';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { countShown, spendShown } from '@/lib/insights';
import { repeatsShown } from '@/lib/replay-words';
import { durationShown, type SearchEstimate } from '@/lib/search';

type SearchEstimateSummaryProps = {
  estimate: SearchEstimate | undefined;
  repeats: number;
  asked: boolean;
  estimating: boolean;
  refusal: string | null;
};

const ROW = 'flex items-baseline justify-between gap-3';

export function SearchEstimateSummary({
  estimate,
  repeats,
  asked,
  estimating,
  refusal,
}: SearchEstimateSummaryProps) {
  let body: ReactNode;

  if (!asked) {
    body = (
      <p className="text-muted-foreground text-xs">
        Choose a replay set and a budget to see what the search may run and
        spend.
      </p>
    );
  } else if (refusal) {
    body = (
      <p role="alert" className="text-destructive text-xs">
        {refusal}
      </p>
    );
  } else if (!estimate) {
    body = (
      <div className="flex flex-col gap-1">
        <SkeletonLine className="w-40 text-xs" />
        <SkeletonLine className="w-32 text-xs" />
      </div>
    );
  } else {
    const { runs, perReplayAllotments: allotted } = estimate;

    body = (
      <dl className="flex flex-col gap-1 text-xs">
        <div className={ROW}>
          <dt className="text-muted-foreground">Tasks</dt>
          <dd className="text-foreground tabular-nums">
            {countShown(estimate.searchedTasks)} searched ·{' '}
            {countShown(estimate.heldOutTasks)} held out
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">Copies</dt>
          <dd className="text-foreground">{repeatsShown(repeats)}</dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">At most</dt>
          <dd className="text-right text-foreground tabular-nums">
            {countShown(runs.total)} runs
            <span className="block text-muted-foreground">
              {countShown(runs.seed)} of the live config ·{' '}
              {countShown(runs.searchReplays)} of candidates ·{' '}
              {countShown(runs.heldOutReplays)} held out ·{' '}
              {countShown(runs.agent)} of the agent
            </span>
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">Spends at most</dt>
          <dd className="text-right text-foreground tabular-nums">
            {spendShown(estimate.ceiling)}
            <span className="block text-muted-foreground">
              {spendShown(allotted.seed)} for the live config ·{' '}
              {spendShown(allotted.searchReplay)} per candidate ·{' '}
              {spendShown(allotted.heldOutReplay)} per held-out replay ·{' '}
              {spendShown(allotted.agentRun)} per agent run
            </span>
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">Takes</dt>
          <dd className="text-right text-foreground">
            {durationShown(estimate.estimatedDuration)}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <section
      aria-label="Estimate"
      aria-busy={estimating}
      data-slot="search-estimate"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      {body}
      {asked && estimate && !refusal && (
        <p className="text-muted-foreground text-xs leading-5">
          An agent run may go a little over what it is given, so the search may
          end slightly over its ceiling.
        </p>
      )}
    </section>
  );
}
