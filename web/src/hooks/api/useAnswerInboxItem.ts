import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { answerInboxItem } from '@/lib/api';
import type { ApprovalInput } from '@/lib/approval';
import { refreshAfterWrite } from '@/lib/live-writes';

type AnswerInboxItemInput = {
  slug: string;
  itemId: string;
  body: string;
  attachments: string[];
  approve?: boolean;
  ask?: number;
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
      ask,
      inputs,
      coAuthors,
      draftGeneration,
    }: AnswerInboxItemInput) => {
      const { response } = await answerInboxItem({
        path: { slug, itemId },
        body: {
          body,
          attachments,
          coAuthors,
          draftGeneration,
          ...(approve === undefined ? {} : { approve }),
          ...(ask === undefined ? {} : { ask }),
          ...(inputs ? { inputs: [...inputs] } : {}),
        },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.forWorkspace(slug),
        runNotesKeys.all,
        teamRunKeys.all,
      ]);
    },
  });
}
