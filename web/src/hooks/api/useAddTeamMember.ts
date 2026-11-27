import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { memberKeys } from '@/hooks/api/useMembers';
import { workspaceMemberKeys } from '@/hooks/api/useWorkspaceMembers';
import { addTeamMember } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useAddTeamMember(
  slug: string | undefined,
  teamId: string | undefined,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await addTeamMember({
        path: { teamId: required(teamId) },
        body: { userId },
      });

      if (error !== undefined) {
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
