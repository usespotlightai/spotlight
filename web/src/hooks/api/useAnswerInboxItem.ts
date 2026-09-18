import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { answerInboxItem } from '@/lib/api';

type AnswerInboxItemInput = {
  slug: string;
  itemId: string;
  body: string;
  attachments: string[];
  approve?: boolean;
};

export function useAnswerInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slug,
      itemId,
      body,
      attachments,
      approve,
    }: AnswerInboxItemInput) => {
      await answerInboxItem({
        path: { slug, itemId },
        body: {
          body,
          attachments,
          ...(approve === undefined ? {} : { approve }),
        },
        throwOnError: true,
      });
    },

    onSuccess: (_answer, { slug }) =>
      queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      }),
  });
}
