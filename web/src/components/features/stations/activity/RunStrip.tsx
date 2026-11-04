import { TONE_FILL } from '@/components/features/stations/activity/outcome-tones';
import {
  formatEnding,
  outcomeTone,
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

const SHOWN = 16;

export function RunStrip({ runs }: { runs: readonly StationRunOutcome[] }) {
  const latest = runs.slice(-SHOWN);

  return (
    <span
      role="img"
      aria-label={`Latest ${latest.length} runs, oldest first: ${summaryOf(latest)}`}
      className="flex h-8 items-end gap-0.5"
    >
      {latest.map((run) => (
        <span
          key={run.runId}
          title={formatEnding(run.ending)}
          className={cn(
            'h-full w-1.5 shrink-0 rounded-[2px]',
            TONE_FILL[outcomeTone(run)],
          )}
        />
      ))}
    </span>
  );
}
