import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tokenKeys } from '@/hooks/api/useWorkspaceTokens';
import { createWorkspaceToken } from '@/lib/api';
import { messageOf } from '@/lib/error';
import type { TokenSpec } from '@/lib/token';

const WORKSPACE_TOKEN_HEADER = 'Spotlight-Workspace-Token';

export type CreatedWorkspaceToken = {
  name: string;
  token: string;
};

export function useCreateWorkspaceToken(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspace-tokens', 'create'],
    mutationFn: async (spec: TokenSpec): Promise<CreatedWorkspaceToken> => {
      const { data, error, response } = await createWorkspaceToken({
        path: { workspaceId: workspaceId as string },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: spec,
      });

      const token = response?.headers.get(WORKSPACE_TOKEN_HEADER);

      if (data && token) {
        return { name: data.name, token };
      }

      if (response?.status === 409) {
        throw new Error(
          `Token ${spec.name} already exists. Please choose another name.`,
        );
      }

      throw new Error(
        messageOf(error, 'Sorry, the token couldn’t be created.'),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: tokenKeys.forWorkspace(workspaceId),
      }),
  });
}
