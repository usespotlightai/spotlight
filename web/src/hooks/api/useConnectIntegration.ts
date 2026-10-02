import { useMutation } from '@tanstack/react-query';
import { connectIntegration } from '@/lib/api';

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
      window.location.href = data.url;
    },
  });
}
