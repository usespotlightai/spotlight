import { useQuery } from '@tanstack/react-query';
import { listMyEmails } from '@/lib/api';

export const myEmailKeys = {
  all: ['my-emails'] as const,
};

export function useMyEmails() {
  return useQuery({
    queryKey: myEmailKeys.all,
    queryFn: async () => {
      const { data } = await listMyEmails({ throwOnError: true });
      return data;
    },
  });
}
