import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceKeys } from '@/hooks/api/useDeviceCode';
import { authClient } from '@/lib/authClient';
import {
  type DeviceDecision,
  type DeviceStatus,
  TOO_MANY_ATTEMPTS,
} from '@/lib/device';

const DECIDED: Record<DeviceDecision, DeviceStatus> = {
  approve: 'approved',
  deny: 'denied',
};

const REASONS: Record<number, string> = {
  400: 'Sorry, the code is no longer open. Please run spotlight login again.',
  403: 'Sorry, another account opened this code. Please run spotlight login again.',
  429: TOO_MANY_ATTEMPTS,
};

export function useDecideDevice(userCode: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (decision: DeviceDecision) => {
      const decide =
        decision === 'approve'
          ? authClient.device.approve
          : authClient.device.deny;
      const { error } = await decide({ userCode });

      if (error) {
        throw new Error(
          REASONS[error.status] ??
            'Sorry, the decision couldn’t be saved. Please try again.',
        );
      }
    },
    onSuccess: (_, decision) =>
      queryClient.setQueryData(
        deviceKeys.byUserCode(userCode),
        DECIDED[decision],
      ),
  });
}
