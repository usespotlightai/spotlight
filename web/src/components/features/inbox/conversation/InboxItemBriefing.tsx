import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { BriefingCard } from '@/components/features/runs/BriefingCard';
import type { InboxItem } from '@/lib/inbox';

type InboxItemBriefingProps = {
  item: InboxItem;
};

export function InboxItemBriefing({ item }: InboxItemBriefingProps) {
  if (item.briefing) {
    return (
      <BriefingCard briefing={item.briefing} attachments={item.attachments} />
    );
  }

  return (
    <InboxAsked
      station={{ ...item.originStation, count: item.stationCount }}
      title={item.title}
      description={item.description}
      attachments={item.attachments}
    />
  );
}
