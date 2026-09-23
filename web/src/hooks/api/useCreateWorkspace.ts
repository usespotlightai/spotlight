import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { openWorkspace } from '@/lib/api';
import { messageOf } from '@/lib/error';

export type CreateWorkspaceInput = {
  name: string;
  slug: string;
  teamName: string;
};

export class WorkspaceSlugTakenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceSlugTakenError';
  }
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspaces', 'create'],
    mutationFn: async ({ name, slug, teamName }: CreateWorkspaceInput) => {
      const { data, error, response } = await openWorkspace({
        body: { name, slug, teamName },
      });

      if (data) {
        return data;
      }

      const message = messageOf(error, 'Could not create the workspace');
      throw response?.status === 409
        ? new WorkspaceSlugTakenError(message)
        : new Error(message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
