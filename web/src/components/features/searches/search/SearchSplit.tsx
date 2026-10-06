import { ChevronRight } from 'lucide-react';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { countShown } from '@/lib/insights';
import type { ReplaySet } from '@/lib/replay';
import { runPath } from '@/lib/run';
import { type SearchDetail, setTaskTitle } from '@/lib/search';

type SearchSplitProps = {
  slug: string;
  teamId: string;
  split: SearchDetail['split'];
  set: ReplaySet | undefined;
};

export function SearchSplit({ slug, teamId, split, set }: SearchSplitProps) {
  return (
    <section aria-labelledby="split" className="flex flex-col gap-2">
      <ReplaysHeading title="Tasks" id="split" level="h2" />

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm">
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground text-xs">Searched</dt>
            <dd className="text-foreground tabular-nums">
              {countShown(split.searchedTasks)}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground text-xs">Held out</dt>
            <dd className="text-foreground tabular-nums">
              {countShown(split.heldOutTasks)}
            </dd>
          </div>
        </dl>

        <p className="text-muted-foreground text-xs leading-5">
          Search agent sees only the searched tasks and their scores. Held-out
          tasks stay hidden. The best candidates replay on them after searching,
          to check they didn’t just fit what it saw.
        </p>

        {split.heldOut.length > 0 && (
          <details className="group text-xs">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground">
              <ChevronRight
                aria-hidden
                className="size-3.5 transition-transform group-open:rotate-90"
              />
              The held-out tasks
            </summary>
            <ul
              aria-label="Held-out tasks"
              className="mt-1.5 flex flex-col gap-1 pl-4"
            >
              {split.heldOut.map((entry) => (
                <li key={entry.runId} className="min-w-0 truncate">
                  <TrailLink
                    to={runPath(slug, teamId, entry.runId)}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {setTaskTitle(entry, set)}
                  </TrailLink>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
