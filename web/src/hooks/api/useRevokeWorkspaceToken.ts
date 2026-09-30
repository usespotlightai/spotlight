import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tokenKeys } from '@/hooks/api/useWorkspaceTokens';
import { deleteWorkspaceToken } from '@/lib/api';
import type { WorkspaceToken } from '@/lib/token';

export function useRevokeWorkspaceToken(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspace-tokens', 'revoke'],
    mutationFn: async (token: Pick<WorkspaceToken, 'id' | 'version'>) => {
      await deleteWorkspaceToken({
        path: { id: token.id },
        headers: { 'If-Match': `"${token.version}"` },
        throwOnError: true,
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: tokenKeys.forWorkspace(workspaceId),
      }),
  });
}
