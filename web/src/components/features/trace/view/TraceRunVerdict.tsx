import { Scale } from 'lucide-react';
import { useRunScores } from '@/hooks/api/useRunScores';
import { scoreShown } from '@/lib/judge';

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
      className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs"
    >
      <Scale aria-hidden className="size-3" />
      <span className="sr-only">Judged</span>
      {scoreShown(judge)}
    </span>
  );
}
