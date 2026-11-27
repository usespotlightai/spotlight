import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePagedList, type PagedList } from '@/hooks/api/usePagedList';
import {
  listInbox,
  readInboxItem,
  readInboxNotice,
  type InboxItemViewResponseDto,
  type InboxNoticeResponseDto,
} from '@/lib/api';
import { entryKey, type InboxEntry } from '@/lib/inbox';
import { liveStaleTime, useLivePoll } from '@/lib/live';
import { required } from '@/lib/required';

export const inboxKeys = {
  all: ['inbox'] as const,
  forWorkspace: (slug?: string) => ['inbox', slug ?? null] as const,
  open: (slug?: string) => ['inbox', slug ?? null, 'open'] as const,
  resolved: (slug?: string) => ['inbox', slug ?? null, 'resolved'] as const,
  item: (slug?: string, itemId?: string) =>
    ['inbox', slug ?? null, 'item', itemId ?? null] as const,
  notice: (slug?: string, noticeId?: string) =>
    ['inbox', slug ?? null, 'notice', noticeId ?? null] as const,
};

const POLL_MS = 10_000;

export function useInbox(
  slug: string | undefined,
): UseQueryResult<InboxEntry[]> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: inboxKeys.open(slug),
    enabled: Boolean(slug),
    refetchInterval: livePollMs,
    staleTime: liveStaleTime,
    queryFn: async () => {
      const { data } = await listInbox({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data.items;
    },
  });
}

export function useResolvedInbox(
  slug: string | undefined,
): PagedList<InboxEntry> {
  return usePagedList({
    queryKey: inboxKeys.resolved(slug),
    enabled: Boolean(slug),
    keyOf: entryKey,
    fetchPage: async (before?: string) => {
      const { data } = await listInbox({
        path: { slug: required(slug) },
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
): UseQueryResult<InboxItemViewResponseDto> {
  const livePollMs = useLivePoll(POLL_MS);

  return useQuery({
    queryKey: inboxKeys.item(slug, itemId),
    enabled:
      slug !== undefined &&
      slug !== '' &&
      itemId !== undefined &&
      itemId !== '',
    refetchInterval: livePollMs,
    staleTime: liveStaleTime,
    queryFn: async () => {
      const { data } = await readInboxItem({
        path: { slug: required(slug), itemId: required(itemId) },
        throwOnError: true,
      });
      return data;
    },
  });
}

export function useInboxNotice(
  slug: string | undefined,
  noticeId: string | undefined,
): UseQueryResult<InboxNoticeResponseDto> {
  return useQuery({
    queryKey: inboxKeys.notice(slug, noticeId),
    enabled:
      slug !== undefined &&
      slug !== '' &&
      noticeId !== undefined &&
      noticeId !== '',
    queryFn: async () => {
      const { data } = await readInboxNotice({
        path: { slug: required(slug), noticeId: required(noticeId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
