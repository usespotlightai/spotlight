import { TONE_FILL } from '@/components/features/stations/activity/outcome-tones';
import {
  outcomeTone,
  type StationRunOutcome,
  resolutionLabel,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

const summaryOf = (runs: readonly StationRunOutcome[]): string => {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const shown = resolutionLabel(run);
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
      aria-label={`Latest ${latest.length} runs, oldest to latest: ${summaryOf(latest)}`}
      title="Oldest to latest"
      className="flex h-6 items-end gap-0.5"
    >
      {latest.map((run) => (
        <span
          key={run.runId}
          title={resolutionLabel(run)}
          className={cn(
            'h-full max-w-2 flex-1 rounded-[2px]',
            TONE_FILL[outcomeTone(run)],
          )}
        />
      ))}
    </span>
  );
}
