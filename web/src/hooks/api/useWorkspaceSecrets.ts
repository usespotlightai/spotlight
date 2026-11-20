import { useQuery } from '@tanstack/react-query';

import { listWorkspaceSecrets } from '@/lib/api';

export const secretKeys = {
  forWorkspace: (slug?: string) => ['workspace-secrets', slug ?? null] as const,
};

export function useWorkspaceSecrets(slug: string | undefined) {
  return useQuery({
    queryKey: secretKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceSecrets({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
