import { useQuery } from '@tanstack/react-query';

import { readJudgeDisagreement } from '@/lib/api';
import type { JudgeDisagreement } from '@/lib/judge-disagreement';

export const judgeDisagreementKeys = {
  of: (teamId: string | undefined, disagreementId: string | undefined) =>
    ['judge-disagreement', teamId ?? null, disagreementId ?? null] as const,
};

export function useJudgeDisagreement(
  teamId: string | undefined,
  disagreementId: string | undefined,
) {
  return useQuery({
    queryKey: judgeDisagreementKeys.of(teamId, disagreementId),
    enabled: Boolean(teamId && disagreementId),
    queryFn: async (): Promise<JudgeDisagreement> => {
      const { data } = await readJudgeDisagreement({
        path: {
          teamId: teamId as string,
          disagreementId: disagreementId as string,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
