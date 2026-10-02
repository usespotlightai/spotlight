import { Sparkles } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { spendShown } from '@/lib/insights';
import type { ReplayedStation } from '@/lib/replay';
import { failureShown, unpricedCallsShown } from '@/lib/replay-words';
import { type SearchRun, searchLabel, searchPath } from '@/lib/search';

const LINK = 'text-foreground underline-offset-2 hover:underline';

type SearchRunBannerProps = {
  at: ReplayedStation | null;
  run: SearchRun;
  number: number | null;
};

export function SearchRunBanner({ at, run, number }: SearchRunBannerProps) {
  const { data: harnesses } = useHarnesses();
  const agent = run.agent;
  const harness = agent
    ? (harnesses?.find((each) => each.id === agent.harness)?.name ??
      agent.harness)
    : null;
  const spent = run.spent.spentCosts;

  return (
    <div
      data-slot="search-run-banner"
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        <Sparkles aria-hidden className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          Iteration {run.iteration} of
        </span>
        {at ? (
          <TrailLink to={searchPath(at, run.searchId)} className={LINK}>
            {searchLabel(number)}
          </TrailLink>
        ) : (
          <span className="text-foreground">a search</span>
        )}
      </p>

      <div className="flex flex-col gap-1 text-muted-foreground text-xs">
        {harness && agent && (
          <p>
            Its agent ran on{' '}
            <span className="text-foreground">
              {[harness, agent.model, agent.effort].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
        {!run.spend && (spent.length > 0 || run.spent.unpricedCalls > 0) && (
          <p className="tabular-nums">
            Spent{' '}
            <span className="text-foreground">
              {spent.length > 0 ? spent.map(spendShown).join(' · ') : '–'}
            </span>
            {run.spent.unpricedCalls > 0 &&
              ` · ${unpricedCallsShown(run.spent.unpricedCalls)} not priced`}
          </p>
        )}
        {run.failure && (
          <p className="text-destructive">
            It failed: {failureShown(run.failure)}
          </p>
        )}
      </div>
    </div>
  );
}
