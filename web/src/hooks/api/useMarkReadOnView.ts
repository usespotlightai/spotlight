import { useEffect, useRef } from 'react';
import { useMarkInboxItemRead } from '@/hooks/api/useMarkInboxItemRead';
import { useMarkInboxRequestRead } from '@/hooks/api/useMarkInboxRequestRead';
import type { InboxItem } from '@/lib/inbox';

export function useMarkReadOnView(
  slug: string | undefined,
  item: InboxItem | undefined,
) {
  const markItemRead = useMarkInboxItemRead();
  const markRequestRead = useMarkInboxRequestRead();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (!slug || !item?.unread || !at || seen.current === at) {
      return;
    }

    seen.current = at;

    if (item.inboxRequest) {
      markRequestRead.mutate({ slug, requestId: item.id });
    } else {
      markItemRead.mutate({ slug, itemId: item.id });
    }
  }, [slug, item, markItemRead.mutate, markRequestRead.mutate]);
}
