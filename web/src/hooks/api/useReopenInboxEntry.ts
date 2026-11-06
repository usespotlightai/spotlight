import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchInboxEntry } from '@/hooks/api/inboxEntryPatch';
import { inboxKeys } from '@/hooks/api/useInbox';
import {
  reopenInboxItem,
  reopenInboxNotice,
  reopenInboxRequest,
} from '@/lib/api';
import type { InboxItem, InboxNotice } from '@/lib/inbox';

type ReopenInboxEntryInput = {
  slug: string;
  entry: InboxItem | InboxNotice;
};

const reopening = ({ slug, entry }: ReopenInboxEntryInput) => {
  if (entry.kind === 'notice') {
    return reopenInboxNotice({
      path: { slug, noticeId: entry.id },
      throwOnError: true,
    });
  }

  return entry.inboxRequest
    ? reopenInboxRequest({
        path: { slug, requestId: entry.id },
        throwOnError: true,
      })
    : reopenInboxItem({
        path: { slug, itemId: entry.id },
        throwOnError: true,
      });
};

export function useReopenInboxEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReopenInboxEntryInput) => {
      await reopening(input);
    },

    onMutate: ({ slug, entry }) => ({
      rollback: patchInboxEntry(queryClient, slug, entry, { resolved: false }),
    }),

    onError: (_error, _input, context) => context?.rollback(),

    onSettled: (_reopened, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
