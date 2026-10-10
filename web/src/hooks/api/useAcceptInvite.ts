import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvite } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useAcceptInvite(token: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await acceptInvite({
        path: { token: token as string },
      });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the invitation couldn’t be accepted.'),
        );
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
