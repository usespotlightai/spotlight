import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listMembers, type MemberResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const memberKeys = {
  all: ['members'] as const,
  forTeam: (teamId?: string) => ['members', teamId ?? null] as const,
};

export function useMembers(
  teamId: string | undefined,
): UseQueryResult<MemberResponseDto[]> {
  return useQuery({
    queryKey: memberKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listMembers({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
