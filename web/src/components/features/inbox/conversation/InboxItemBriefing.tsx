import type { ReactElement } from 'react';

import { InboxAsked } from '@/components/features/inbox/conversation/InboxAsked';
import type { InboxItem } from '@/lib/inbox';

type InboxItemBriefingProps = {
  item: InboxItem;
};

export function InboxItemBriefing({
  item,
}: InboxItemBriefingProps): ReactElement {
  return (
    <InboxAsked
      station={{ ...item.originStation, count: item.stationCount }}
      title={item.title}
      description={item.description}
      attachments={item.attachments}
    />
  );
}
