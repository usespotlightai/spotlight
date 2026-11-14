import { useEffect, useRef } from 'react';

import { useMarkInboxItemRead } from '@/hooks/api/useMarkInboxItemRead';
import { useMarkInboxRequestRead } from '@/hooks/api/useMarkInboxRequestRead';
import { followed, type InboxItemView } from '@/lib/inbox';

export function useMarkReadOnView(
  slug: string | undefined,
  item: InboxItemView | undefined,
) {
  const { mutate: markItemRead } = useMarkInboxItemRead();
  const { mutate: markRequestRead } = useMarkInboxRequestRead();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (
      !slug ||
      !item?.unread ||
      followed(item) ||
      !at ||
      seen.current === at
    ) {
      return;
    }

    seen.current = at;

    if (item.inboxRequest) {
      markRequestRead({ slug, requestId: item.id });
    } else {
      markItemRead({ slug, itemId: item.id });
    }
  }, [slug, item, markItemRead, markRequestRead]);
}
