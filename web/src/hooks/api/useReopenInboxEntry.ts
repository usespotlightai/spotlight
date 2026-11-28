import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { patchInboxEntry } from '@/hooks/api/inboxEntryPatch';
import { inboxKeys } from '@/hooks/api/useInbox';
import {
  reopenInboxChat,
  reopenInboxItem,
  reopenInboxNotice,
  reopenInboxRequest,
} from '@/lib/api';
import { actOnParts, type InboxPart, type ResolvableEntry } from '@/lib/inbox';

type ReopenInboxEntryInput = {
  slug: string;
  entry: ResolvableEntry;
};

const reopeningPart = (slug: string, part: InboxPart) =>
  part.form === null
    ? reopenInboxItem({ path: { slug, itemId: part.id }, throwOnError: true })
    : reopenInboxRequest({
        path: { slug, requestId: part.id },
        throwOnError: true,
      });

const reopening = async ({ slug, entry }: ReopenInboxEntryInput) => {
  if (entry.kind === 'chat') {
    return reopenInboxChat({
      path: { slug, chatId: entry.id },
      throwOnError: true,
    });
  }

  if (entry.kind === 'notice') {
    return reopenInboxNotice({
      path: { slug, noticeId: entry.id },
      throwOnError: true,
    });
  }

  // Reopening a task's item reopens what its last resolve closed.
  await actOnParts(
    entry.parts.filter((part) => part.reopenable),
    (part) => reopeningPart(slug, part),
  );
};

export function useReopenInboxEntry(): UseMutationResult<
  void,
  Error,
  ReopenInboxEntryInput,
  { rollback: () => void }
> {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { optimistic: true },
    mutationFn: async (input: ReopenInboxEntryInput) => {
      await reopening(input);
    },

    onMutate: ({ slug, entry }) => ({
      rollback: patchInboxEntry(queryClient, slug, entry, {
        resolved: false,
        section: 'open',
        reopenable: false,
        ...(entry.kind === 'task' || entry.kind === 'notice'
          ? { resolvable: true }
          : {}),
        ...(entry.kind === 'task' && entry.conversationId !== null
          ? { answerable: true }
          : {}),
      }),
    }),

    onError: (_error, _input, context) => context?.rollback(),

    onSettled: (_reopened, _error, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
