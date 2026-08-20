import { useQuery } from '@tanstack/react-query';
import { getGreeting } from '@/lib/api';

export const greetingKeys = {
  all: ['greeting'] as const,
};

export function useGreeting() {
  return useQuery({
    queryKey: greetingKeys.all,
    queryFn: async () => {
      const { data } = await getGreeting({ throwOnError: true });
      return data;
    },
  });
}
