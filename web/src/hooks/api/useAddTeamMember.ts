import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { addTeamMember } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useAddTeamMember(
  slug: string | undefined,
  teamId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await addTeamMember({
        path: { teamId: teamId as string },
        body: { userId },
      });

      if (error) {
        throw new Error(
          messageOf(error, 'Sorry, the member couldn’t be added.'),
        );
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: memberKeys.forTeam(teamId) }),
        queryClient.invalidateQueries({
          queryKey: workspaceMemberKeys.forWorkspace(slug),
        }),
      ]),
  });
}
