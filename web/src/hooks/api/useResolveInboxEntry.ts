import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { patchInboxEntry } from '@/hooks/api/inboxEntryPatch';
import { inboxKeys } from '@/hooks/api/useInbox';
import {
  resolveInboxChat,
  resolveInboxItem,
  resolveInboxNotice,
  resolveInboxRequest,
} from '@/lib/api';
import type { InboxPart, ResolvableEntry } from '@/lib/inbox';

type ResolveInboxEntryInput = {
  slug: string;
  entry: ResolvableEntry;
};

const resolvingPart = (slug: string, part: InboxPart) =>
  part.form === null
    ? resolveInboxItem({ path: { slug, itemId: part.id }, throwOnError: true })
    : resolveInboxRequest({
        path: { slug, requestId: part.id },
        throwOnError: true,
      });

const resolving = async ({ slug, entry }: ResolveInboxEntryInput) => {
  if (entry.kind === 'chat') {
    return resolveInboxChat({
      path: { slug, chatId: entry.id },
      throwOnError: true,
    });
  }

  if (entry.kind === 'notice') {
    return resolveInboxNotice({
      path: { slug, noticeId: entry.id },
      throwOnError: true,
    });
  }

  // Resolving a task's item resolves each part the server says it covers.
  await Promise.all(
    entry.parts
      .filter((part) => part.resolvable)
      .map((part) => resolvingPart(slug, part)),
  );
};

// Shown as resolved at once only when every open part goes with it.
const wholly = (entry: ResolvableEntry): boolean =>
  entry.kind !== 'task' ||
  entry.parts.every((part) => !part.open || part.resolvable);

export function useResolveInboxEntry(): UseMutationResult<
  void,
  Error,
  ResolveInboxEntryInput,
  { rollback: () => void }
> {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { optimistic: true },
    mutationFn: async (input: ResolveInboxEntryInput) => {
      await resolving(input);
    },

    onMutate: ({ slug, entry }) => ({
      rollback: wholly(entry)
        ? patchInboxEntry(queryClient, slug, entry, {
            resolved: true,
            unread: false,
            unreadCount: 0,
            section: 'resolved',
            reopenable: true,
            ...(entry.kind === 'task' || entry.kind === 'notice'
              ? { resolvable: false }
              : {}),
          })
        : () => {},
    }),

    onError: (_error, _input, context) => context?.rollback(),

    onSettled: (_resolved, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
