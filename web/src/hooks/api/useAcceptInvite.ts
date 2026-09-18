import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvite } from '@/lib/api';

export function useAcceptInvite(token: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await acceptInvite({
        path: { token: token as string },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
