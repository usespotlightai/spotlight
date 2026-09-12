import type { ReactNode } from 'react';
import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { Attachment } from '@/lib/attachment';
import type { TeamRun } from '@/lib/run';

type RunOpeningProps = {
  run: TeamRun;
  briefing: string | null;
  attachments: readonly Attachment[];
  activity?: ReactNode;
};

export function RunOpening({
  run,
  briefing,
  attachments,
  activity,
}: RunOpeningProps) {
  const scroller = useStickToBottom<HTMLDivElement>();

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
        <TimeMarker at={run.startedAt} />

        <div className="mt-6">
          {briefing ? (
            <RunBriefing briefing={briefing} attachments={attachments} />
          ) : (
            <InboxAsked
              station={run.station}
              title={run.taskTitle}
              description={run.taskDescription}
              attachments={attachments}
            />
          )}
        </div>

        {activity}
      </div>
    </div>
  );
}
