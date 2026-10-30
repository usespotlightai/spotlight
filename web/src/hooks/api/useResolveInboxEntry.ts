import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import {
  resolveInboxItem,
  resolveInboxNotice,
  resolveInboxRequest,
} from '@/lib/api';
import {
  entryKey,
  type InboxEntry,
  type InboxItem,
  type InboxNotice,
} from '@/lib/inbox';

type ResolveInboxEntryInput = {
  slug: string;
  entry: InboxItem | InboxNotice;
};

const resolving = ({ slug, entry }: ResolveInboxEntryInput) => {
  if (entry.kind === 'notice') {
    return resolveInboxNotice({
      path: { slug, noticeId: entry.id },
      throwOnError: true,
    });
  }

  return entry.inboxRequest
    ? resolveInboxRequest({
        path: { slug, requestId: entry.id },
        throwOnError: true,
      })
    : resolveInboxItem({
        path: { slug, itemId: entry.id },
        throwOnError: true,
      });
};

export function useResolveInboxEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResolveInboxEntryInput) => {
      await resolving(input);
    },

    onMutate: ({ slug, entry }) => {
      const key = inboxKeys.forWorkspace(slug);
      const previous = queryClient.getQueryData<InboxEntry[]>(key);

      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((each) =>
            entryKey(each) === entryKey(entry)
              ? { ...each, resolved: true, unread: false }
              : each,
          ),
        );
      }

      void queryClient.cancelQueries({ queryKey: key });

      return { previous };
    },

    onError: (_error, { slug }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          inboxKeys.forWorkspace(slug),
          context.previous,
        );
      }
    },

    onSettled: (_resolved, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
