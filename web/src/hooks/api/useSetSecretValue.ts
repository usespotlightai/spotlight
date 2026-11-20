import { useMutation, useQueryClient } from '@tanstack/react-query';

import { secretKeys } from '@/hooks/api/useWorkspaceSecrets';
import { setWorkspaceSecretValue } from '@/lib/api';

export function useSetSecretValue(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['workspace-secrets', 'set-value'],
    mutationFn: async ({ name, value }: { name: string; value: string }) => {
      await setWorkspaceSecretValue({
        path: { slug: slug as string, name },
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
