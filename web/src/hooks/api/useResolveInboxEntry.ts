import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchInboxEntry } from '@/hooks/api/inboxEntryPatch';
import { inboxKeys } from '@/hooks/api/useInbox';
import {
  resolveInboxChat,
  resolveInboxItem,
  resolveInboxNotice,
  resolveInboxRequest,
} from '@/lib/api';
import type { ResolvableEntry } from '@/lib/inbox';

type ResolveInboxEntryInput = {
  slug: string;
  entry: ResolvableEntry;
};

const resolving = ({ slug, entry }: ResolveInboxEntryInput) => {
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

    onMutate: ({ slug, entry }) => ({
      rollback: patchInboxEntry(queryClient, slug, entry, {
        resolved: true,
        unread: false,
        section: 'resolved',
        reopenable: true,
      }),
    }),

    onError: (_error, _input, context) => context?.rollback(),

    onSettled: (_resolved, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
