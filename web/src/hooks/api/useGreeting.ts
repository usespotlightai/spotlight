import { useQuery } from '@tanstack/react-query';
import { getGreeting } from '@/lib/api';

export const greetingKeys = {
  all: ['greeting'] as const,
  forName: (name?: string) => ['greeting', name ?? null] as const,
};

export function useGreeting(name?: string) {
  return useQuery({
    queryKey: greetingKeys.forName(name),
    queryFn: async () => {
      const { data } = await getGreeting({
        throwOnError: true,
        query: name ? { name } : undefined,
      });
      return data;
    },
  });
}
