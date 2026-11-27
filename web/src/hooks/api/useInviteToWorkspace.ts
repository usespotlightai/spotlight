import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import {
  type InviteToWorkspaceRequestDto,
  inviteToWorkspace,
  type InviteOutcomeResponseDto,
} from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useInviteToWorkspace(
  slug: string | undefined,
): UseMutationResult<
  InviteOutcomeResponseDto[],
  Error,
  InviteToWorkspaceRequestDto
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (spec: InviteToWorkspaceRequestDto) => {
      const { data, error, response } = await inviteToWorkspace({
        path: { slug: required(slug) },
        body: spec,
      });

      if (data) {
        return data.outcomes;
      }

      throw new Error(
        response?.status === 404
          ? 'Sorry, you can no longer invite people to this workspace.'
          : messageOf(error, 'Sorry, the invites couldn’t be sent.'),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      });
      void queryClient.invalidateQueries({
        queryKey: workspaceMemberKeys.forWorkspace(slug),
      });
    },
  });
}
