import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { answerInboxItem } from '@/lib/api';

type AnswerInboxItemInput = {
  slug: string;
  taskId: string;
  body: string;
};

export function useAnswerInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ slug, taskId, body }: AnswerInboxItemInput) => {
      await answerInboxItem({
        path: { slug, taskId },
        body: { body },
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
