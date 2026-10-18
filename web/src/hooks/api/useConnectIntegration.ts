import { useMutation } from '@tanstack/react-query';
import {
  type ConnectIntegrationRequestDto,
  connectIntegration,
} from '@/lib/api';

type Connecting = ConnectIntegrationRequestDto & { integration: string };

export function useConnectIntegration(teamId: string | undefined) {
  return useMutation({
    mutationFn: async ({ integration, ...body }: Connecting) => {
      const { data } = await connectIntegration({
        path: { teamId: teamId as string, integration },
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
