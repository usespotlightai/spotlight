import type { ReactNode } from 'react';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { formatCount, formatSpend } from '@/lib/insights';
import { formatRepeats } from '@/lib/replay-words';
import { formatDuration, type SearchEstimate } from '@/lib/search';

type SearchEstimateSummaryProps = {
  estimate: SearchEstimate | undefined;
  repeats: number;
  requested: boolean;
  estimating: boolean;
  problem: string | null;
};

const ROW = 'flex items-baseline justify-between gap-3';

export function SearchEstimateSummary({
  estimate,
  repeats,
  requested,
  estimating,
  problem,
}: SearchEstimateSummaryProps) {
  let body: ReactNode;

  if (!requested) {
    body = (
      <p className="text-muted-foreground text-xs">
        Choose a replay set and budget to see the estimated runs and spend.
      </p>
    );
  } else if (problem) {
    body = (
      <p role="alert" className="text-destructive text-xs">
        {problem}
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
            {formatCount(estimate.searchedTasks)} searched ·{' '}
            {formatCount(estimate.heldOutTasks)} held out
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">Copies</dt>
          <dd className="text-foreground">{formatRepeats(repeats)}</dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">At most</dt>
          <dd className="text-right text-foreground tabular-nums">
            {formatCount(runs.total)} runs
            <span className="block text-muted-foreground">
              {formatCount(runs.seed)} of the live config ·{' '}
              {formatCount(runs.searchReplays)} of candidates ·{' '}
              {formatCount(runs.heldOutReplays)} held out ·{' '}
              {formatCount(runs.agent)} of the agent
            </span>
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">Spends at most</dt>
          <dd className="text-right text-foreground tabular-nums">
            {formatSpend(estimate.ceiling)}
            <span className="block text-muted-foreground">
              {formatSpend(allotted.seed)} for the live config ·{' '}
              {formatSpend(allotted.searchReplay)} per candidate ·{' '}
              {formatSpend(allotted.heldOutReplay)} per held-out replay ·{' '}
              {formatSpend(allotted.agentRun)} per agent run
            </span>
          </dd>
        </div>
        <div className={ROW}>
          <dt className="text-muted-foreground">Takes</dt>
          <dd className="text-right text-foreground">
            {formatDuration(estimate.estimatedDuration)}
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
      {requested && estimate && !problem && (
        <p className="text-muted-foreground text-xs leading-5">
          An agent run may slightly overspend. The search may end a little over
          its ceiling.
        </p>
      )}
    </section>
  );
}
