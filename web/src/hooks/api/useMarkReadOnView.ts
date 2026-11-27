import { useEffect, useRef } from 'react';

import { useMarkInboxItemRead } from '@/hooks/api/useMarkInboxItemRead';
import { useMarkInboxRequestRead } from '@/hooks/api/useMarkInboxRequestRead';
import type { InboxItemView } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

// Opening a task's item reads what is new on it: each part the server counts
// as unread for this person, through that part's own read.
export function useMarkReadOnView(
  slug: string | undefined,
  item: InboxItemView | undefined,
): void {
  const { mutate: markItemRead } = useMarkInboxItemRead();
  const { mutate: markRequestRead } = useMarkInboxRequestRead();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const unread = item?.parts.filter((part) => part.unread) ?? [];

    if (!nonEmpty(slug) || !item || unread.length === 0) {
      return;
    }

    const at = `${item.id}:${unread.map((part) => part.id).join(',')}`;

    if (seen.current === at) {
      return;
    }

    seen.current = at;

    for (const part of unread) {
      if (part.form === null) {
        markItemRead({ slug, itemId: part.id });
      } else {
        markRequestRead({ slug, requestId: part.id });
      }
    }
  }, [slug, item, markItemRead, markRequestRead]);
}
