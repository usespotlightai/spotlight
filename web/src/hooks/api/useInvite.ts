import { useQuery } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useInvites';
import { readInvite } from '@/lib/api';

export function useInvite(token: string | undefined) {
  return useQuery({
    queryKey: inviteKeys.byToken(token),
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const { data } = await readInvite({
        path: { token: token as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
