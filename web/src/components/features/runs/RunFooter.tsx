import { RunComposer } from '@/components/features/runs/RunComposer';
import { type TeamRun, waitsOnPerson } from '@/lib/run';
import type { RunConversation } from '@/lib/run-conversation';

type RunFooterProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  said: RunConversation | undefined;
  deciding: boolean;
};

export function RunFooter({
  slug,
  teamId,
  run,
  said,
  deciding,
}: RunFooterProps) {
  if (run.station?.name !== said?.station?.name) {
    return (
      <p className="pb-5 text-center text-muted-foreground text-xs">
        Task has moved to another station. Messages here reach no one.
      </p>
    );
  }

  return (
    <RunComposer
      slug={slug}
      teamId={teamId}
      runId={run.id}
      taskId={said?.taskId}
      station={run.station?.name ?? 'the agent'}
      stationId={run.station?.id}
      running={run.state === 'claimed'}
      answering={waitsOnPerson(run) && !deciding}
    />
  );
}
