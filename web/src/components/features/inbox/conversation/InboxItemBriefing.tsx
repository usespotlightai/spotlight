import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import type { InboxItem } from '@/lib/inbox';

type InboxItemBriefingProps = {
  item: InboxItem;
};

export function InboxItemBriefing({ item }: InboxItemBriefingProps) {
  return (
    <InboxAsked
      station={{ ...item.originStation, count: item.stationCount }}
      title={item.title}
      description={item.description}
      attachments={item.attachments}
    />
  );
}
