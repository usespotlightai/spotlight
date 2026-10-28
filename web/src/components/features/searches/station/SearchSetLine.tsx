import type { ReplaySet } from '@/lib/replay';
import { formatTasks, tasksIn } from '@/lib/search';

type SearchSetLineProps = {
  set: ReplaySet;
  problem: string | null;
};

export function SearchSetLine({ set, problem }: SearchSetLineProps) {
  return (
    <div data-slot="search-set" className="flex flex-col gap-1.5 text-xs">
      <p className="text-muted-foreground">
        Searches on the station’s replay set:{' '}
        <span className="text-foreground">{formatTasks(tasksIn(set))}</span>.
        Spotlight refreshes the set before the search starts.
      </p>
      {problem && (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
