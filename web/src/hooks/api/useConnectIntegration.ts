import { useMutation } from '@tanstack/react-query';

import {
  type ConnectIntegrationRequestDto,
  connectIntegration,
} from '@/lib/api';
import { desktopApp } from '@/lib/desktop';

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
      const app = desktopApp();

      if (app) {
        app.authorize(data.url);
      } else {
        window.location.href = data.url;
      }
    },
  });
}
