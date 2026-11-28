import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { inboxKeys } from '@/hooks/api/useInbox';
import { inboxItemPath, type InboxItemView } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

// A link from before items were one per task can name an inbox request. The
// server opens its task; the address follows, so the list marks the task.
// A link to a conversation keeps its address: it opens on that conversation.
export function useCanonicalInboxItem(
  slug: string | undefined,
  requested: string | undefined,
  item: InboxItemView | undefined,
): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { search } = location;
  const state: unknown = location.state;
  const canonical = item?.id;
  const request = item?.parts.some(
    (part) => part.id === requested && part.form !== null,
  );

  useEffect(() => {
    if (
      !nonEmpty(slug) ||
      !nonEmpty(requested) ||
      !item ||
      !nonEmpty(canonical) ||
      request !== true
    ) {
      return;
    }

    queryClient.setQueryData(inboxKeys.item(slug, canonical), item);
    void navigate(`${inboxItemPath(slug, canonical)}${search}`, {
      replace: true,
      state,
    });
  }, [
    queryClient,
    navigate,
    slug,
    requested,
    canonical,
    request,
    item,
    search,
    state,
  ]);
}
