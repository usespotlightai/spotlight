import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { type InviteToWorkspaceRequestDto, inviteToWorkspace } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useInviteToWorkspace(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (terms: InviteToWorkspaceRequestDto) => {
      const { data, error, response } = await inviteToWorkspace({
        path: { slug: slug as string },
        body: terms,
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
      queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceMemberKeys.forWorkspace(slug),
      });
    },
  });
}
