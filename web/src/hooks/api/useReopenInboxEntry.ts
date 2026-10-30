import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import {
  reopenInboxItem,
  reopenInboxNotice,
  reopenInboxRequest,
} from '@/lib/api';
import { entryKey, type InboxEntry } from '@/lib/inbox';

type ReopenInboxEntryInput = {
  slug: string;
  entry: InboxEntry;
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

    onMutate: ({ slug, entry }) => {
      const key = inboxKeys.forWorkspace(slug);
      const previous = queryClient.getQueryData<InboxEntry[]>(key);

      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((each) =>
            entryKey(each) === entryKey(entry)
              ? { ...each, resolved: false }
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

    onSettled: (_reopened, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
