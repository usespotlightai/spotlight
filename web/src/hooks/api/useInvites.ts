import { useQuery } from '@tanstack/react-query';
import { listInvites } from '@/lib/api';

export const inviteKeys = {
  forTeam: (teamId?: string) => ['invites', teamId ?? null] as const,
  byToken: (token?: string) => ['invite', token ?? null] as const,
};

export function useInvites(teamId: string | undefined) {
  return useQuery({
    queryKey: inviteKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listInvites({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
