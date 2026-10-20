import { RunComposer } from '@/components/features/runs/RunComposer';
import { type TeamRun, waitsOnPerson } from '@/lib/run';
import type { RunNotes } from '@/lib/run-notes';

type RunFooterProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  conversation: RunNotes | undefined;
  deciding: boolean;
  onSent?: () => void;
};

export function RunFooter({
  slug,
  teamId,
  run,
  conversation,
  deciding,
  onSent,
}: RunFooterProps) {
  if (run.station?.name !== conversation?.station?.name) {
    return (
      <p className="pb-5 text-center text-muted-foreground text-xs">
        The task has moved to another station. Messages here reach no one.
      </p>
    );
  }

  return (
    <RunComposer
      slug={slug}
      teamId={teamId}
      runId={run.id}
      taskId={conversation?.taskId}
      station={run.station?.name ?? 'the agent'}
      stationId={run.station?.id}
      running={run.state === 'claimed'}
      answering={waitsOnPerson(run) && !deciding}
      onSent={onSent}
    />
  );
}
