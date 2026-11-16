import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { judgeDisagreementKeys } from '@/hooks/api/useJudgeDisagreement';
import { answerJudgeDisagreementClaim } from '@/lib/api';
import type { ClaimAnswerBody } from '@/lib/judge-disagreement';

type AnswerDisagreementClaimInput = {
  slug: string;
  teamId: string;
  disagreementId: string;
  claim: number;
  answer: ClaimAnswerBody;
};

export function useAnswerDisagreementClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      disagreementId,
      claim,
      answer,
    }: AnswerDisagreementClaimInput) => {
      const { data } = await answerJudgeDisagreementClaim({
        path: { teamId, disagreementId, claim },
        body: answer,
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (disagreement, { slug, teamId, disagreementId }) => {
      queryClient.setQueryData(
        judgeDisagreementKeys.of(teamId, disagreementId),
        disagreement,
      );
      void queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      });
    },

    onError: (_error, { teamId, disagreementId }) =>
      queryClient.invalidateQueries({
        queryKey: judgeDisagreementKeys.of(teamId, disagreementId),
      }),
  });
}
