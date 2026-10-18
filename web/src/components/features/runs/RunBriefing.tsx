import type { ReactNode } from 'react';
import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { BriefingCard } from '@/components/features/runs/BriefingCard';
import { RunImage } from '@/components/features/runs/RunImage';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { Attachment } from '@/lib/attachment';
import type { TeamRun } from '@/lib/run';
import { useRunSidePanel } from '@/lib/run-side-panel';

type RunBriefingProps = {
  run: TeamRun;
  briefing: string | null;
  attachments: readonly Attachment[];
  activity?: ReactNode;
  closing?: ReactNode;
  footer: ReactNode;
};

export function RunBriefing({
  run,
  briefing,
  attachments,
  activity,
  closing,
  footer,
}: RunBriefingProps) {
  const scroller = useStickToBottom<HTMLDivElement>();
  const { sidePanel } = useRunSidePanel();

  return (
    <PaneScroller
      ref={scroller}
      sidePanel={sidePanel}
      footer={<ComposerFooter>{footer}</ComposerFooter>}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
        <TimeMarker at={run.startedAt} />
        <RunImage image={run.image} />

        <div className="mt-6">
          {briefing ? (
            <BriefingCard briefing={briefing} attachments={attachments} />
          ) : (
            <InboxAsked
              station={run.station}
              title={run.taskTitle}
              description={run.taskDescription}
              attachments={attachments}
            />
          )}
        </div>

        {activity && <div className="mt-6 empty:hidden">{activity}</div>}

        {closing && <div className="mt-3">{closing}</div>}
      </div>
    </PaneScroller>
  );
}
