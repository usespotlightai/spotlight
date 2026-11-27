import type { ReactElement } from 'react';

import { RunActions } from '@/components/features/runs/RunActions';
import { RunWaiting } from '@/components/features/runs/RunWaiting';
import { lastNoteAt, type RunJournal } from '@/lib/inbox';
import type { TeamRun } from '@/lib/run';
import { type RunNotes, runThreadText } from '@/lib/run-notes';

type RunClosingProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  conversation: RunNotes | undefined;
  ran: readonly RunJournal[];
};

export function RunClosing({
  slug,
  teamId,
  run,
  conversation,
  ran,
}: RunClosingProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <RunActions
        slug={slug}
        teamId={teamId}
        runId={run.id}
        thread={runThreadText(conversation, run, ran)}
        at={lastNoteAt(conversation?.notes ?? [], ran) ?? run.updatedAt}
      />
      {run.waitingForYou && <RunWaiting slug={slug} run={run} />}
    </div>
  );
}
