import {
  endedBadly,
  formatEnding,
  type StationRunOutcome,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

const summaryOf = (runs: readonly StationRunOutcome[]): string => {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const shown = formatEnding(run.ending);
    counts.set(shown, (counts.get(shown) ?? 0) + 1);
  }

  return [...counts]
    .map(([ending, count]) => `${count} ${ending.toLowerCase()}`)
    .join(', ');
};

export function RunStrip({ runs }: { runs: readonly StationRunOutcome[] }) {
  return (
    <span
      role="img"
      aria-label={`Latest runs, oldest first: ${summaryOf(runs)}`}
      className="flex flex-wrap gap-1.5"
    >
      {runs.map((run) => (
        <span
          key={run.runId}
          title={formatEnding(run.ending)}
          className={cn(
            'size-3.5 rounded-[3px]',
            run.ending === 'completed'
              ? 'bg-chart-primary'
              : endedBadly(run.ending)
                ? 'bg-destructive'
                : 'bg-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}
