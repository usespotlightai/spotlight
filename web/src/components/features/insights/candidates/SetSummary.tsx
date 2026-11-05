import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { type CandidatesSet, replayedTasksOf } from '@/lib/insights-candidates';
import { healthReadingsOf } from '@/lib/replay-words';
import type { TooltipNote } from '@/lib/tooltip-note';

type SetSummaryProps = {
  set: CandidatesSet;
};

const NOT_RUN = new Set(['unknown', 'pending']);

export function SetSummary({ set }: SetSummaryProps) {
  const readings = healthReadingsOf(set.health, set.health.minGain);
  const warnings = readings.filter((each) => each.tone === 'bad');
  const [first] = warnings;
  const health: TooltipNote = {
    title: 'Replay set health',
    rows: readings.map((each) => [
      each.label,
      NOT_RUN.has(each.tone) ? 'Not run yet' : each.text,
    ]),
  };

  return (
    <div
      data-slot="replay-set-health"
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground"
    >
      <span className="flex items-center gap-1">
        {replayedTasksOf(set.health.tasks, set.health.runs)}
        <InfoTooltip tooltip={health} />
      </span>

      {first && (
        <WithTooltip tooltip={warnings.map((each) => each.advice).join(' ')}>
          <span data-slot="set-warning" className="text-outcome-failed">
            {first.label}: {first.text}
            {warnings.length > 1 && `, and ${warnings.length - 1} more`}
          </span>
        </WithTooltip>
      )}

      {set.stationGone && <span>Station gone</span>}

      {!set.baseline && <span>The live config hasn’t been replayed here.</span>}
    </div>
  );
}
