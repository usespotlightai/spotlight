import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { type DeviceStatus, TOO_MANY_ATTEMPTS } from '@/lib/device';
import { required } from '@/lib/required';

const DEVICE_STATUSES: readonly DeviceStatus[] = [
  'pending',
  'approved',
  'denied',
];

export const deviceKeys = {
  byUserCode: (userCode: string | null) =>
    ['auth', 'device', userCode] as const,
};

export function useDeviceCode(
  userCode: string | null,
  signedIn: boolean,
): UseQueryResult<DeviceStatus | null> {
  return useQuery({
    queryKey: deviceKeys.byUserCode(userCode),
    enabled: Boolean(userCode) && signedIn,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    meta: { persist: false },
    queryFn: async (): Promise<DeviceStatus | null> => {
      const { data, error } = await authClient.device({
        query: { user_code: required(userCode) },
      });

      if (error?.status === 400) {
        return null;
      }
      if (error?.status === 429) {
        throw new Error(TOO_MANY_ATTEMPTS);
      }
      if (!data) {
        throw new Error('Sorry, the code couldn’t be checked.');
      }
      const status = DEVICE_STATUSES.find((each) => each === data.status);

      if (status === undefined) {
        throw new Error('Sorry, the code couldn’t be checked.');
      }
      return status;
    },
  });
}
