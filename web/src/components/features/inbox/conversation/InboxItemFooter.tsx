import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import type { InboxItem } from '@/lib/inbox';
import type { Progress } from '@/lib/run';

type InboxItemFooterProps = {
  slug: string;
  item: InboxItem;
  progress: Progress | null;
};

export function InboxItemFooter({
  slug,
  item,
  progress,
}: InboxItemFooterProps) {
  if (!item.resolved) {
    return (
      <InboxComposer
        slug={slug}
        itemId={item.id}
        taskId={item.taskId}
        station={item.station}
        teamId={item.teamId}
        runId={item.runId}
        running={progress === 'in-progress'}
      />
    );
  }

  return (
    <p className="pb-5 text-center text-muted-foreground text-xs">
      {item.currentStation.name === item.station
        ? 'The conversation is closed here. Nothing is left to answer.'
        : `The task moved on to ${item.currentStation.name}. Nothing is left to answer.`}
    </p>
  );
}
