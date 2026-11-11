import { useQuery } from '@tanstack/react-query';

import { getPushKey } from '@/lib/api';

const pushKeyKeys = {
  all: ['push-key'] as const,
};

export function usePushKey() {
  return useQuery({
    queryKey: pushKeyKeys.all,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await getPushKey({ throwOnError: true });
      return data.publicKey;
    },
  });
}
