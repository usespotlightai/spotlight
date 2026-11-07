import { useQuery } from '@tanstack/react-query';
import { usePagedList } from '@/hooks/api/usePagedList';
import { listInbox, readInboxItem, readInboxNotice } from '@/lib/api';
import { entryKey } from '@/lib/inbox';

export const inboxKeys = {
  forWorkspace: (slug?: string) => ['inbox', slug ?? null] as const,
  open: (slug?: string) => ['inbox', slug ?? null, 'open'] as const,
  resolved: (slug?: string) => ['inbox', slug ?? null, 'resolved'] as const,
  item: (slug?: string, itemId?: string) =>
    ['inbox', slug ?? null, 'item', itemId ?? null] as const,
  notice: (slug?: string, noticeId?: string) =>
    ['inbox', slug ?? null, 'notice', noticeId ?? null] as const,
};

const POLL_MS = 10_000;

export function useInbox(slug: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.open(slug),
    enabled: Boolean(slug),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listInbox({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data.items;
    },
  });
}

export function useResolvedInbox(slug: string | undefined) {
  return usePagedList({
    queryKey: inboxKeys.resolved(slug),
    enabled: Boolean(slug),
    keyOf: entryKey,
    fetchPage: async (before?: string) => {
      const { data } = await listInbox({
        path: { slug: slug as string },
        query: { state: 'resolved', before },
        throwOnError: true,
      });
      return data;
    },
  });
}

export function useInboxItem(
  slug: string | undefined,
  itemId: string | undefined,
) {
  return useQuery({
    queryKey: inboxKeys.item(slug, itemId),
    enabled: Boolean(slug && itemId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readInboxItem({
        path: { slug: slug as string, itemId: itemId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}

export function useInboxNotice(
  slug: string | undefined,
  noticeId: string | undefined,
) {
  return useQuery({
    queryKey: inboxKeys.notice(slug, noticeId),
    enabled: Boolean(slug && noticeId),
    queryFn: async () => {
      const { data } = await readInboxNotice({
        path: { slug: slug as string, noticeId: noticeId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
