import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { type CandidatesSet, replayedTasksOf } from '@/lib/insights-candidates';
import { type HealthReading, healthReadingsOf } from '@/lib/replay-words';
import type { TooltipNote } from '@/lib/tooltip-note';

type SetSummaryProps = {
  set: CandidatesSet;
};

const NOT_RUN = new Set(['unknown', 'pending']);

const reading = (each: HealthReading): string => `${each.label}: ${each.text}`;

const warningNote = (warnings: readonly HealthReading[]): TooltipNote => {
  const [only] = warnings;

  return warnings.length === 1 && only
    ? { title: only.label, body: only.advice, rows: only.rows }
    : {
        title: 'Replay set warnings',
        body: warnings.map((each) => `${each.label}. ${each.advice}`).join(' '),
        list: { title: 'Warnings', items: warnings.map(reading) },
      };
};

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
        <span data-slot="set-warning" className="flex items-center gap-1.5">
          <WarningTooltip
            tone="warning"
            label="Replay set warnings"
            tooltip={warningNote(warnings)}
          />
          {reading(first)}
          {warnings.length > 1 && `, and ${warnings.length - 1} more`}
        </span>
      )}

      {set.stationGone && <span>Station gone</span>}

      {!set.baseline && <span>The live config hasn’t been replayed here.</span>}
    </div>
  );
}
