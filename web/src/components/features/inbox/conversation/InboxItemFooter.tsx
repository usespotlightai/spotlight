import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import type { InboxItem } from '@/lib/inbox';
import { type ReportedActivity, stoppable } from '@/lib/run';

type InboxItemFooterProps = {
  slug: string;
  item: InboxItem;
  activity: ReportedActivity | null;
};

export function InboxItemFooter({
  slug,
  item,
  activity,
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
        running={stoppable({ state: null, activity })}
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
