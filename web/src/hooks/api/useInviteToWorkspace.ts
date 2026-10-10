import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { type InviteToWorkspaceRequestDto, inviteToWorkspace } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useInviteToWorkspace(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (terms: InviteToWorkspaceRequestDto) => {
      const { data, error } = await inviteToWorkspace({
        path: { slug: slug as string },
        body: terms,
      });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the invites couldn’t be sent.'),
        );
      }
      return data.outcomes;
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
