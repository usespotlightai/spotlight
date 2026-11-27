import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { judgeDisagreementKeys } from '@/hooks/api/useJudgeDisagreement';
import {
  answerJudgeDisagreement,
  type JudgeDisagreementResponseDto,
} from '@/lib/api';
import type { NotMetAnswer } from '@/lib/judge-disagreement';

type AnswerJudgeDisagreementInput = {
  slug: string;
  teamId: string;
  disagreementId: string;
  answer: NotMetAnswer;
};

export function useAnswerJudgeDisagreement(): UseMutationResult<
  JudgeDisagreementResponseDto,
  Error,
  AnswerJudgeDisagreementInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      disagreementId,
      answer,
    }: AnswerJudgeDisagreementInput) => {
      const { data } = await answerJudgeDisagreement({
        path: { teamId, disagreementId },
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
