import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listWorkspaceSecrets,
  type WorkspaceSecretResponseDto,
} from '@/lib/api';
import { required } from '@/lib/required';

export const secretKeys = {
  forWorkspace: (slug?: string) => ['workspace-secrets', slug ?? null] as const,
};

export function useWorkspaceSecrets(
  slug: string | undefined,
): UseQueryResult<WorkspaceSecretResponseDto[]> {
  return useQuery({
    queryKey: secretKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceSecrets({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
