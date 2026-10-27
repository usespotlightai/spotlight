import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { answerInboxItem } from '@/lib/api';
import type { ApprovalInput } from '@/lib/approval';

type AnswerInboxItemInput = {
  slug: string;
  itemId: string;
  body: string;
  attachments: string[];
  approve?: boolean;
  inputs?: readonly ApprovalInput[];
  coAuthors?: string[];
  draftGeneration?: number;
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
      coAuthors,
      draftGeneration,
    }: AnswerInboxItemInput) => {
      await answerInboxItem({
        path: { slug, itemId },
        body: {
          body,
          attachments,
          coAuthors,
          draftGeneration,
          ...(approve === undefined ? {} : { approve }),
          ...(inputs ? { inputs: [...inputs] } : {}),
        },
        throwOnError: true,
      });
    },

    onSuccess: (_answer, { slug }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: inboxKeys.forWorkspace(slug),
        }),
        queryClient.invalidateQueries({
          queryKey: runNotesKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: teamRunKeys.all,
        }),
      ]),
  });
}
