import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { answerInboxItem } from '@/lib/api';

type AnswerInboxItemInput = {
  slug: string;
  itemId: string;
  body: string;
  attachments: string[];
};

export function useAnswerInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slug,
      itemId,
      body,
      attachments,
    }: AnswerInboxItemInput) => {
      await answerInboxItem({
        path: { slug, itemId },
        body: { body, attachments },
        throwOnError: true,
      });
    },

    // The answer puts the task back to work, so it leaves the inbox: what the
    // list shows next is the server's to say.
    onSuccess: (_answer, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
