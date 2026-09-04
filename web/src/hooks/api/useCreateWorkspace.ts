import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { createWorkspace } from '@/lib/api';

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

const messageFrom = (body: unknown, fallback: string): string =>
  typeof body === 'object' &&
  body !== null &&
  'message' in body &&
  typeof body.message === 'string'
    ? body.message
    : fallback;

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspaces', 'create'],
    mutationFn: async ({ name, slug, teamName }: CreateWorkspaceInput) => {
      const { data, error, response } = await createWorkspace({
        body: { name, slug, teamName },
      });

      if (data) {
        return data;
      }

      const message = messageFrom(error, 'Could not create the workspace');
      throw response?.status === 409
        ? new WorkspaceSlugTakenError(message)
        : new Error(message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
