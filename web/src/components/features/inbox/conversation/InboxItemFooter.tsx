import { InboxComposer } from '@/components/features/inbox/conversation/InboxComposer';
import type { InboxItem } from '@/lib/inbox';

type InboxItemFooterProps = {
  slug: string;
  item: InboxItem;
};

export function InboxItemFooter({ slug, item }: InboxItemFooterProps) {
  if (!item.resolved) {
    return (
      <InboxComposer
        slug={slug}
        itemId={item.id}
        taskId={item.taskId}
        station={item.station}
        teamId={item.teamId}
        runId={item.runId}
        running={item.working}
      />
    );
  }

  return (
    <p className="pb-5 text-center text-muted-foreground text-xs">
      {item.standsAt.name === item.station
        ? 'Settled. Nothing left to answer.'
        : `Moved on to ${item.standsAt.name}. Nothing left to answer.`}
    </p>
  );
}
