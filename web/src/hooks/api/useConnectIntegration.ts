import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import {
  type ConnectIntegrationRequestDto,
  connectIntegration,
  type OAuth2StartResponseDto,
} from '@/lib/api';
import { desktopApp } from '@/lib/desktop';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

type Connecting = ConnectIntegrationRequestDto & { integration: string };

export function useConnectIntegration(
  teamId: string | undefined,
): UseMutationResult<OAuth2StartResponseDto, Error, Connecting> {
  return useMutation({
    mutationFn: async ({ integration, ...body }: Connecting) => {
      const { data, error } = await connectIntegration({
        path: { teamId: required(teamId), integration },
        body,
      });

      if (error !== undefined || !data) {
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
