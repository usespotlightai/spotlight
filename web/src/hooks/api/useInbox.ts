import { useQuery } from '@tanstack/react-query';
import { listInbox } from '@/lib/api';
import type { InboxEntry } from '@/lib/inbox';

export const inboxKeys = {
  forWorkspace: (slug?: string) => ['inbox', slug ?? null] as const,
};

const POLL_MS = 10_000;
const WELCOME_POLL_MS = 1_000;
const WELCOME_WAIT_MS = 15_000;

const openedAt = new Map<string, number>();

export const openedJustNow = (slug: string, now = Date.now()): void => {
  openedAt.set(slug, now);
};

export const pollEvery = (
  slug: string,
  items: readonly InboxEntry[] | undefined,
  now = Date.now(),
): number => {
  const at = openedAt.get(slug);

  if (at === undefined) {
    return POLL_MS;
  }

  if ((items && items.length > 0) || now - at >= WELCOME_WAIT_MS) {
    openedAt.delete(slug);
    return POLL_MS;
  }

  return WELCOME_POLL_MS;
};

export function useInbox(slug: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    refetchInterval: (query) =>
      slug ? pollEvery(slug, query.state.data) : POLL_MS,
    queryFn: async () => {
      const { data } = await listInbox({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
