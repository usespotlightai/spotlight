import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { answerStackQuestion } from '@/lib/api';
import { answeredIn, type RunChangeStacks } from '@/lib/change-stack';

type AnswerStackQuestionInput = {
  teamId: string;
  runId: string;
  stackId: string;
  questionId: string;
  reply: string | null;
};

export function useAnswerStackQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      stackId,
      questionId,
      reply,
    }: AnswerStackQuestionInput) => {
      const { data } = await answerStackQuestion({
        path: { teamId, runId, stackId, questionId },
        body: { reply },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (answer, { runId, stackId }) => {
      queryClient.setQueryData<RunChangeStacks>(
        changeStackKeys.forRun(runId),
        (stacks) => stacks && answeredIn(stacks, stackId, answer),
      );
    },

    onError: (_error, { runId }) =>
      queryClient.invalidateQueries({
        queryKey: changeStackKeys.forRun(runId),
      }),
  });
}
