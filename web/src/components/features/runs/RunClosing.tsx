import { RunActions } from '@/components/features/runs/RunActions';
import { RunWaiting } from '@/components/features/runs/RunWaiting';
import { lastNoteAt, type RunJournal } from '@/lib/inbox';
import { type TeamRun, waitsOnPerson } from '@/lib/run';
import { type RunConversation, runThreadText } from '@/lib/run-conversation';

type RunClosingProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  conversation: RunConversation | undefined;
  ran: readonly RunJournal[];
  deciding: boolean;
};

export function RunClosing({
  slug,
  teamId,
  run,
  conversation,
  ran,
  deciding,
}: RunClosingProps) {
  return (
    <div className="flex flex-col gap-6">
      <RunActions
        slug={slug}
        teamId={teamId}
        runId={run.id}
        thread={runThreadText(conversation, run, ran)}
        at={lastNoteAt(conversation?.notes ?? [], ran) ?? run.updatedAt}
      />
      {waitsOnPerson(run) && (
        <RunWaiting slug={slug} run={run} deciding={deciding} />
      )}
    </div>
  );
}
