import { useEffect, useRef } from 'react';
import { useReadInboxAside } from '@/hooks/api/useReadInboxAside';
import { useReadInboxItem } from '@/hooks/api/useReadInboxItem';
import type { InboxItem } from '@/lib/inbox';

export function useReadOnSight(
  slug: string | undefined,
  item: InboxItem | undefined,
) {
  const read = useReadInboxItem();
  const readAside = useReadInboxAside();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const at = item && `${item.id}:${item.notes.length}`;

    if (!slug || !item?.unread || !at || seen.current === at) {
      return;
    }

    seen.current = at;

    if (item.aside) {
      readAside.mutate({ slug, asideId: item.id });
    } else {
      read.mutate({ slug, itemId: item.id });
    }
  }, [slug, item, read.mutate, readAside.mutate]);
}
