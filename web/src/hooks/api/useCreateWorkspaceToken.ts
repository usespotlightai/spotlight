import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tokenKeys } from '@/hooks/api/useWorkspaceTokens';
import { createWorkspaceToken } from '@/lib/api';
import { messageOf } from '@/lib/error';
import type { TokenTerms } from '@/lib/token';

const WORKSPACE_TOKEN_HEADER = 'Spotlight-Workspace-Token';

export type CreatedWorkspaceToken = {
  name: string;
  token: string;
};

export class WorkspaceTokenNameTakenError extends Error {
  readonly token: string;

  constructor(token: string) {
    super(`A token named ${token} already exists`);
    this.name = 'WorkspaceTokenNameTakenError';
    this.token = token;
  }
}

export function useCreateWorkspaceToken(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspace-tokens', 'create'],
    mutationFn: async (terms: TokenTerms): Promise<CreatedWorkspaceToken> => {
      const { data, error, response } = await createWorkspaceToken({
        path: { workspaceId: workspaceId as string },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: terms,
      });

      const token = response?.headers.get(WORKSPACE_TOKEN_HEADER);

      if (data && token) {
        return { name: data.name, token };
      }

      if (response?.status === 409) {
        throw new WorkspaceTokenNameTakenError(terms.name);
      }

      throw new Error(messageOf(error, 'Could not create the token'));
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: tokenKeys.forWorkspace(workspaceId),
      }),
  });
}
