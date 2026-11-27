import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { answerStackQuestion, type QuestionAnswerResponseDto } from '@/lib/api';
import { answeredIn, type ChangeStacks } from '@/lib/change-stack';

type AnswerStackQuestionInput = {
  teamId: string;
  stackId: string;
  questionId: string;
  reply: string | null;
};

const LISTS = [changeStackKeys.ofRuns, changeStackKeys.ofTasks];

export function useAnswerStackQuestion(): UseMutationResult<
  QuestionAnswerResponseDto,
  Error,
  AnswerStackQuestionInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      stackId,
      questionId,
      reply,
    }: AnswerStackQuestionInput) => {
      const { data } = await answerStackQuestion({
        path: { teamId, stackId, questionId },
        body: { reply },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (answer, { stackId }) => {
      for (const queryKey of LISTS) {
        queryClient.setQueriesData<ChangeStacks>(
          { queryKey },
          (stacks) => stacks && answeredIn(stacks, stackId, answer),
        );
      }
    },

    onError: () =>
      Promise.all(
        LISTS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}
