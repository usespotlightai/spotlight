import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readJudgeDisagreement } from '@/lib/api';
import type { JudgeDisagreement } from '@/lib/judge-disagreement';
import { required } from '@/lib/required';

export const judgeDisagreementKeys = {
  of: (teamId: string | undefined, disagreementId: string | undefined) =>
    ['judge-disagreement', teamId ?? null, disagreementId ?? null] as const,
};

export function useJudgeDisagreement(
  teamId: string | undefined,
  disagreementId: string | undefined,
): UseQueryResult<JudgeDisagreement> {
  return useQuery({
    queryKey: judgeDisagreementKeys.of(teamId, disagreementId),
    enabled:
      teamId !== undefined &&
      teamId !== '' &&
      disagreementId !== undefined &&
      disagreementId !== '',
    queryFn: async (): Promise<JudgeDisagreement> => {
      const { data } = await readJudgeDisagreement({
        path: {
          teamId: required(teamId),
          disagreementId: required(disagreementId),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
