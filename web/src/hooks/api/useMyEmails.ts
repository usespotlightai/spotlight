import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listMyEmails, type UserEmailsResponseDto } from '@/lib/api';

export const myEmailKeys = {
  all: ['my-emails'] as const,
};

export function useMyEmails(): UseQueryResult<UserEmailsResponseDto> {
  return useQuery({
    queryKey: myEmailKeys.all,
    queryFn: async () => {
      const { data } = await listMyEmails({ throwOnError: true });
      return data;
    },
  });
}
