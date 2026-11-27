import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { resendInvite, type WorkspaceInviteResponseDto } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useResendInvite(
  slug: string | undefined,
): UseMutationResult<WorkspaceInviteResponseDto, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await resendInvite({
        path: { slug: required(slug), inviteId },
      });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the invite couldn’t be resent.'),
        );
      }
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      }),
  });
}
