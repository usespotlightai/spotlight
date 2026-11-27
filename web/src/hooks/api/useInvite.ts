import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { readInvite, type InvitePreviewResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export function useInvite(
  token: string | undefined,
): UseQueryResult<InvitePreviewResponseDto | null> {
  return useQuery({
    queryKey: inviteKeys.byToken(token),
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const { data, response } = await readInvite({
        path: { token: required(token) },
      });

      if (response?.status === 404) {
        return null;
      }
      if (!data) {
        throw new Error('Sorry, the invitation couldn’t be loaded.');
      }
      return data;
    },
  });
}
