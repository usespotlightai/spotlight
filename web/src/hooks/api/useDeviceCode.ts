import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import { type DeviceStatus, TOO_MANY_ATTEMPTS } from '@/lib/device';

export const deviceKeys = {
  byUserCode: (userCode: string | null) =>
    ['auth', 'device', userCode] as const,
};

export function useDeviceCode(userCode: string | null, signedIn: boolean) {
  return useQuery({
    queryKey: deviceKeys.byUserCode(userCode),
    enabled: Boolean(userCode) && signedIn,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<DeviceStatus | null> => {
      const { data, error } = await authClient.device({
        query: { user_code: userCode as string },
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
      return data.status as DeviceStatus;
    },
  });
}
