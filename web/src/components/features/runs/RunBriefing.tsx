import type { ReactElement, ReactNode } from 'react';

import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { Attachment } from '@/lib/attachment';
import { STICKY_AT_TOP } from '@/lib/inbox';
import type { TeamRun } from '@/lib/run';
import { useRunSidePanel } from '@/lib/run-side-panel';
import { cn } from '@/lib/utils';

type RunBriefingProps = {
  run: TeamRun;
  attachments: readonly Attachment[];
  activity?: ReactNode;
  closing?: ReactNode;
  footer: ReactNode;
  pills?: ReactNode;
};

export function RunBriefing({
  run,
  attachments,
  activity,
  closing,
  footer,
  pills,
}: RunBriefingProps): ReactElement {
  const scroller = useStickToBottom<HTMLDivElement>();
  const { sidePanel } = useRunSidePanel();

  return (
    <PaneScroller
      ref={scroller}
      sidePanel={sidePanel}
      footer={
        <ComposerFooter>
          <div className="flex flex-col gap-0.5">
            {Boolean(pills) && (
              <div className="flex max-w-full flex-wrap items-center gap-1">
                {pills}
              </div>
            )}
            {footer}
          </div>
        </ComposerFooter>
      }
    >
      <div className={cn(THREAD_COLUMN, 'flex flex-col')}>
        <TimeMarker at={run.startedAt} />

        <div className={cn('mt-6', STICKY_AT_TOP)}>
          <InboxAsked
            station={run.station}
            title={run.taskTitle}
            description={run.taskDescription}
            attachments={attachments}
          />
        </div>

        {Boolean(activity) && (
          <div className="mt-6 empty:hidden">{activity}</div>
        )}

        {Boolean(closing) && <div className="mt-3">{closing}</div>}
      </div>
    </PaneScroller>
  );
}
