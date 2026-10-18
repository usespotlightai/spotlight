import { useEffect, useRef } from 'react';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import { useReadInboxRequest } from '@/hooks/api/useReadInboxRequest';
import type { InboxItem } from '@/lib/inbox';

export function useReadOnSight(
  slug: string | undefined,
  item: InboxItem | undefined,
) {
  const read = useReadInboxItem();
  const readInboxRequest = useReadInboxRequest();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (!slug || !item?.unread || !at || seen.current === at) {
      return;
    }

    seen.current = at;

    if (item.inboxRequest) {
      readInboxRequest.mutate({ slug, requestId: item.id });
    } else {
      read.mutate({ slug, itemId: item.id });
    }
  }, [slug, item, read.mutate, readInboxRequest.mutate]);
}
