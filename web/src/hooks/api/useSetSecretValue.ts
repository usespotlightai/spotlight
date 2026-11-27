import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { secretKeys } from '@/hooks/api/useWorkspaceSecrets';
import { setWorkspaceSecretValue } from '@/lib/api';
import { required } from '@/lib/required';

export function useSetSecretValue(
  slug: string | undefined,
): UseMutationResult<void, Error, { name: string; value: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspace-secrets', 'set-value'],
    mutationFn: async ({ name, value }: { name: string; value: string }) => {
      await setWorkspaceSecretValue({
        path: { slug: required(slug), name },
        body: { value },
        throwOnError: true,
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: secretKeys.forWorkspace(slug),
      }),
  });
}
