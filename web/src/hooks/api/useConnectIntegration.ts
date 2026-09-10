import { useMutation } from '@tanstack/react-query';
import { connectIntegration } from '@/lib/api';

/**
 * Begins linking this team to a host. What comes back is where to send the
 * person to authorize it; the browser goes there, and the host sends it back
 * once the link is made.
 */
export function useConnectIntegration(teamId: string | undefined) {
  return useMutation({
    mutationFn: async (source: string) => {
      const { data } = await connectIntegration({
        path: { teamId: teamId as string, source },
        throwOnError: true,
      });

      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  });
}
