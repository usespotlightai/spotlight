import { useMutation } from '@tanstack/react-query';
import {
  type ConnectIntegrationRequestDto,
  connectIntegration,
} from '@/lib/api';

type Connecting = ConnectIntegrationRequestDto & { source: string };

export function useConnectIntegration(teamId: string | undefined) {
  return useMutation({
    mutationFn: async ({ source, ...body }: Connecting) => {
      const { data } = await connectIntegration({
        path: { teamId: teamId as string, source },
        body,
        throwOnError: true,
      });

      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}
