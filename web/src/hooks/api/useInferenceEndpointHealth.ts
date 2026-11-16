import { useQuery } from '@tanstack/react-query';

import { testInferenceEndpoint } from '@/lib/api';
import type { ConnectionTest, InferenceEndpoint } from '@/lib/inference';

export const PASSED_CHECK_FRESH_FOR_MS = 5 * 60_000;

export function useInferenceEndpointHealth(
  workspaceId: string | undefined,
  endpoint: InferenceEndpoint,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      'inference-endpoint-health',
      workspaceId ?? null,
      endpoint.version,
    ],
    enabled: Boolean(workspaceId) && enabled,
    staleTime: (query) =>
      query.state.data?.ok ? PASSED_CHECK_FRESH_FOR_MS : 0,
    gcTime: PASSED_CHECK_FRESH_FOR_MS,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<ConnectionTest> => {
      const { data } = await testInferenceEndpoint({
        path: { workspaceId: workspaceId as string },
        body: { baseUrl: endpoint.baseUrl, model: endpoint.model },
        throwOnError: true,
      });
      return data;
    },
  });
}
