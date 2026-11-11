import { useMutation, useQueryClient } from '@tanstack/react-query';

import { myEmailKeys } from '@/hooks/api/useMyEmails';
import { verifyMyEmail } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useVerifyMyEmail(token: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await verifyMyEmail({
        path: { token: token as string },
      });

      if (data) {
        return data;
      }

      if (response?.status === 404) {
        throw new Error(
          'The verification link doesn’t work. Please send a new one from your settings.',
        );
      }

      throw new Error(
        messageOf(error, 'Sorry, the email couldn’t be verified.'),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: myEmailKeys.all }),
  });
}
