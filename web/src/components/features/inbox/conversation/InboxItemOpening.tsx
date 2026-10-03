import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import type { InboxItem } from '@/lib/inbox';

type InboxItemOpeningProps = {
  item: InboxItem;
};

export function InboxItemOpening({ item }: InboxItemOpeningProps) {
  if (item.briefing) {
    return (
      <RunBriefing briefing={item.briefing} attachments={item.attachments} />
    );
  }

  return (
    <InboxAsked
      station={{ ...item.raisedAt, count: item.stationCount }}
      title={item.title}
      description={item.description}
      attachments={item.attachments}
    />
  );
}
