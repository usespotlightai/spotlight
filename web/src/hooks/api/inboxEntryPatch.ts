import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import type { Page } from '@/hooks/api/usePagedList';
import {
  entryKey,
  type InboxEntry,
  type InboxItem,
  type InboxNotice,
} from '@/lib/inbox';

type EntryPatch = { resolved: boolean; unread?: boolean };

export const patchInboxEntry = (
  queryClient: QueryClient,
  slug: string,
  entry: InboxItem | InboxNotice,
  patch: EntryPatch,
): (() => void) => {
  const key = entryKey(entry);
  const patched = <T extends InboxEntry>(each: T): T =>
    entryKey(each) === key ? { ...each, ...patch } : each;
  const open = queryClient.getQueryData<InboxEntry[]>(inboxKeys.open(slug));
  const resolved = queryClient.getQueryData<InfiniteData<Page<InboxEntry>>>(
    inboxKeys.resolved(slug),
  );

  if (open) {
    queryClient.setQueryData(inboxKeys.open(slug), open.map(patched));
  }

  if (resolved) {
    queryClient.setQueryData(inboxKeys.resolved(slug), {
      ...resolved,
      pages: resolved.pages.map((page) => ({
        ...page,
        items: page.items.map(patched),
      })),
    });
  }

  void queryClient.cancelQueries({ queryKey: inboxKeys.forWorkspace(slug) });

  return () => {
    if (open) {
      queryClient.setQueryData(inboxKeys.open(slug), open);
    }
    if (resolved) {
      queryClient.setQueryData(inboxKeys.resolved(slug), resolved);
    }
  };
};
