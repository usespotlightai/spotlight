import { useMutation, useQueryClient } from '@tanstack/react-query';
import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { addTeamMember } from '@/lib/api';

export function useAddTeamMember(
  slug: string | undefined,
  teamId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await addTeamMember({
        path: { teamId: teamId as string },
        body: { userId },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.forTeam(teamId) });
      queryClient.invalidateQueries({
        queryKey: workspaceMemberKeys.forWorkspace(slug),
      });
    },
  });
}
