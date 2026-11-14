import { useMutation } from '@tanstack/react-query';

import {
  type ConnectIntegrationRequestDto,
  connectIntegration,
} from '@/lib/api';
import { desktopApp } from '@/lib/desktop';
import { messageOf } from '@/lib/error';

type Connecting = ConnectIntegrationRequestDto & { integration: string };

export function useConnectIntegration(teamId: string | undefined) {
  return useMutation({
    mutationFn: async ({ integration, ...body }: Connecting) => {
      const { data, error } = await connectIntegration({
        path: { teamId: teamId as string, integration },
        body,
      });

      if (error || !data) {
        throw new Error(
          messageOf(
            error,
            'Sorry, the account couldn’t be connected. Please try again.',
          ),
        );
      }

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
