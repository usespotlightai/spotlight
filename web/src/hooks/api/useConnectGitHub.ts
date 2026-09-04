import { useQuery } from '@tanstack/react-query';
import { connectGitHub } from '@/lib/api';

/**
 * Points a workspace at the installation somebody just made.
 *
 * Held as a query rather than fired from an effect: GitHub's redirect lands
 * once, but the page around it mounts more than once, and a mutation started
 * on mount goes again each time and loses its answer in between. Keyed on the
 * installation, it is asked once and what came back stays.
 *
 * The number comes back from GitHub in the address bar, which is why the
 * control-plane asks GitHub whether this person administers it rather than
 * taking the request's word for it.
 */
export function useConnectGitHub(
  slug: string | undefined,
  installationId: string | null,
) {
  return useQuery({
    queryKey: ['github', 'connect', slug ?? null, installationId],
    enabled: Boolean(slug) && Boolean(installationId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    // A refusal is a refusal. Going again only makes a person wait twice as
    // long to read it.
    retry: false,
    queryFn: async () => {
      await connectGitHub({
        path: { slug: slug as string },
        body: { installationId: installationId as string },
        throwOnError: true,
      });

      return true;
    },
  });
}
