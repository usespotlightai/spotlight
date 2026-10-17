import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceQuery } from '@/hooks/api/useWorkspace';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { createWorkspaceWithTeam } from '@/lib/api';
import { messageOf } from '@/lib/error';

export type CreateWorkspaceInput = {
  name: string;
  slug: string;
  teamName: string;
};

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspaces', 'create'],
    mutationFn: async ({ name, slug, teamName }: CreateWorkspaceInput) => {
      const { data, error, response } = await createWorkspaceWithTeam({
        body: { name, slug, teamName },
      });

      if (data) {
        return data;
      }

      throw new Error(
        response?.status === 409
          ? 'This workspace URL is already taken. Please go back and choose another.'
          : messageOf(error, 'Sorry, the workspace couldn’t be created.'),
      );
    },
    onSuccess: (workspace) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.prefetchQuery(workspaceQuery(workspace.slug)),
      ]),
  });
}
