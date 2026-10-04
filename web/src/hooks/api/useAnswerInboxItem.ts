import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { answerInboxItem } from '@/lib/api';
import type { ApprovalInput } from '@/lib/approval';

type AnswerInboxItemInput = {
  slug: string;
  itemId: string;
  body: string;
  attachments: string[];
  approve?: boolean;
  inputs?: readonly ApprovalInput[];
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
      inputs,
    }: AnswerInboxItemInput) => {
      await answerInboxItem({
        path: { slug, itemId },
        body: {
          body,
          attachments,
          ...(approve === undefined ? {} : { approve }),
          ...(inputs ? { inputs: [...inputs] } : {}),
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
