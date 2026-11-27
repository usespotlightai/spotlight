import { useEffect, useRef } from 'react';

import { useMarkInboxItemRead } from '@/hooks/api/useMarkInboxItemRead';
import { useMarkInboxRequestRead } from '@/hooks/api/useMarkInboxRequestRead';
import { followed, type InboxItemView } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

export function useMarkReadOnView(
  slug: string | undefined,
  item: InboxItemView | undefined,
): void {
  const { mutate: markItemRead } = useMarkInboxItemRead();
  const { mutate: markRequestRead } = useMarkInboxRequestRead();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!nonEmpty(slug) || item?.unread !== true || followed(item)) {
      return;
    }

    const at = `${item.id}:${item.notes.length}`;

    if (seen.current === at) {
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
