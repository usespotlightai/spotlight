import { useQuery } from '@tanstack/react-query';

import { listInferenceEndpoints } from '@/lib/api';
import type { InferenceEndpoint } from '@/lib/inference';

export const inferenceEndpointKeys = {
  forWorkspace: (workspaceId?: string) =>
    ['inference-endpoint', workspaceId ?? null] as const,
};

export function useInferenceEndpoint(workspaceId: string | undefined) {
  return useQuery({
    queryKey: inferenceEndpointKeys.forWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<InferenceEndpoint | null> => {
      const { data } = await listInferenceEndpoints({
        path: { workspaceId: workspaceId as string },
        throwOnError: true,
      });
      return data.items[0] ?? null;
    },
  });
}
