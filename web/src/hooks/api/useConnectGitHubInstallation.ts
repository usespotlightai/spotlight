import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { gitHubKeys } from '@/hooks/api/useGitHub';
import { connectGitHub } from '@/lib/api';

export function useConnectGitHubInstallation(
  slug: string,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (installationId: string) => {
      await connectGitHub({
        path: { slug },
        body: { installationId },
        throwOnError: true,
      });
    },
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: gitHubKeys.installations(slug),
      }),
    onSuccess: () =>
      Promise.all(
        [gitHubKeys.status(slug), ['repositories', slug], ['onboarding']].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
