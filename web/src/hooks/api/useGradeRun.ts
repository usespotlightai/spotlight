import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { runScoreKeys } from '@/hooks/api/useRunScores';
import { stationJudgeKeys } from '@/hooks/api/useStationJudge';
import { gradeRun } from '@/lib/api';
import type { GradeValue } from '@/lib/judge';

type GradeRunInput = {
  slug: string;
  teamId: string;
  runId: string;
  stationId: string | undefined;
  value: GradeValue;
};

export function useGradeRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, runId, value }: GradeRunInput) => {
      const { data } = await gradeRun({
        path: { teamId, runId },
        body: { value },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (scores, { slug, runId, stationId }) => {
      queryClient.setQueryData(runScoreKeys.forRun(runId), scores);
      void queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      });
      if (stationId) {
        void queryClient.invalidateQueries({
          queryKey: stationJudgeKeys.forStation(stationId),
        });
      }
    },
  });
}
