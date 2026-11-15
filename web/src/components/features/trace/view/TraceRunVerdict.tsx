import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { useRunScores } from '@/hooks/api/useRunScores';
import {
  DISAGREES_LABEL,
  DISAGREES_NOTE,
  formatJudgeOutcome,
  formatOutcome,
} from '@/lib/judge';

type TraceRunVerdictProps = {
  teamId: string;
  runId: string;
};

export function TraceRunVerdict({ teamId, runId }: TraceRunVerdictProps) {
  const scores = useRunScores(teamId, runId).data;

  if (!scores?.judge) {
    return null;
  }

  const { outcome, judge, agrees } = scores;

  return (
    <span
      data-slot="trace-run-verdict"
      className="ml-1 inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs"
    >
      <span>
        <span className="sr-only">{outcome ? 'Outcome ' : 'Judged '}</span>
        {outcome ? formatOutcome(outcome) : formatJudgeOutcome(judge.passes)}
      </span>
      {agrees === false && (
        <WarningTooltip
          data-slot="trace-run-disagrees"
          label={DISAGREES_LABEL}
          tooltip={DISAGREES_NOTE}
          tone="warning"
        />
      )}
    </span>
  );
}
