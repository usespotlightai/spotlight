import { useRunScores } from '@/hooks/api/useRunScores';
import { formatScore } from '@/lib/judge';

type TraceRunVerdictProps = {
  teamId: string;
  runId: string;
};

export function TraceRunVerdict({ teamId, runId }: TraceRunVerdictProps) {
  const judge = useRunScores(teamId, runId).data?.judge;

  if (!judge) {
    return null;
  }

  return (
    <span
      data-slot="trace-run-verdict"
      className="ml-1 shrink-0 text-muted-foreground text-xs"
    >
      <span className="sr-only">Judged </span>
      {formatScore(judge)}
    </span>
  );
}
